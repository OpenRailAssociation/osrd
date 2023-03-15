package fr.sncf.osrd.envelope.part.constraints;

import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.NEXT_PART;
import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.NEXT_REACHED_END;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.*;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeCursor;
import fr.sncf.osrd.envelope.EnvelopePhysics;
import fr.sncf.osrd.envelope.EnvelopePoint;

public class EnvelopeConstraint implements EnvelopePartConstraint {
    public final Envelope envelope;
    private final EnvelopePartConstraintType type;
    private EnvelopeCursor cursor = null;

    public EnvelopeConstraint(Envelope envelope, EnvelopePartConstraintType type) {
        this.envelope = envelope;
        this.type = type;
    }

    @Override
    public boolean initCheck(double direction, double position, double speed) {
        var partIndex = envelope.findRightDir(position, direction);

        // if the position is off the envelope, fail
        if (partIndex < 0)
            return false;

        var part = envelope.get(partIndex);
        var stepIndex = part.findRightDir(position, direction);
        var envelopeSpeed = part.interpolateSpeed(stepIndex, position);
        cursor = new EnvelopeCursor(envelope, direction < 0, partIndex, stepIndex, position);
        if (type == CEILING)
            return envelopeSpeed >= speed;
        if (type == FLOOR)
            return envelopeSpeed <= speed;
        return true;
    }

    // region INTERSECTION

    private enum NextPointKind {
        /** The base has a point at this position */
        BASE_POINT,
        /** The overlay has a point at this position */
        OVERLAY_POINT,
        /** Both the base and the overlay curves have a point at this position */
        BOTH_POINTS,
    }

    private static final class NextPoint {
        NextPointKind kind;
        double pointPosition;
        double baseSpeed;
        double overlaySpeed;
    }

    /** Given the next point of the overlay, finds the next point after the cursor, which could either be
     * part of the base curve or the overlay curve
     */
    private NextPoint getNextPoint(
            double lastOverlayPos, double lastOverlaySpeed,
            double overlayPos, double overlaySpeed
    ) {
        var res = new NextPoint();
        // two possible cases:
        //  - either the overlay step ends first, and interpolation needs
        //    to be performed on the base curve side
        //  - the base curve step ends first, and interpolation has to be
        //    performed on the overlay step
        var baseStepEnd = cursor.getStepEndPos();
        var delta = cursor.comparePos(overlayPos, baseStepEnd);
        if (delta == 0.0) {
            res.kind = NextPointKind.BOTH_POINTS;
            res.pointPosition = overlayPos;
            res.baseSpeed = cursor.getStepEndSpeed();
            res.overlaySpeed = overlaySpeed;
        } else if (delta < 0) {
            // the overlay point comes first, interpolate on the base
            res.kind = NextPointKind.OVERLAY_POINT;
            res.pointPosition = overlayPos;
            var baseBeginPos = cursor.getStepBeginPos();
            res.baseSpeed = EnvelopePhysics.interpolateStepSpeed(
                    baseBeginPos,
                    cursor.getStepEndPos(),
                    cursor.getStepBeginSpeed(),
                    cursor.getStepEndSpeed(),
                    overlayPos - baseBeginPos
            );
            res.overlaySpeed = overlaySpeed;
        } else {
            // the base point comes first, interpolate on the overlay
            res.kind = NextPointKind.BASE_POINT;
            res.pointPosition = baseStepEnd;
            res.baseSpeed = cursor.getStepEndSpeed();
            res.overlaySpeed = EnvelopePhysics.interpolateStepSpeed(
                    lastOverlayPos,
                    overlayPos,
                    lastOverlaySpeed,
                    overlaySpeed,
                    baseStepEnd - lastOverlayPos
            );
        }
        return res;
    }

    /**
     * Intersects the base curve with the overlay curve.
     * It takes the overlay step data, and adds the intersection point if any.
     * @return Whether an intersection occurred
     */
    private EnvelopePoint intersect(double lastPos, double lastSpeed, double position, double speed) {
        // if the speed ranges do not even intersect, there is no intersection
        var baseMin = Math.min(cursor.getStepEndSpeed(), cursor.getStepBeginSpeed());
        var baseMax = Math.max(cursor.getStepEndSpeed(), cursor.getStepBeginSpeed());
        var overlayMin = Math.min(lastSpeed, speed);
        var overlayMax = Math.max(lastSpeed, speed);
        if (type == CEILING && overlayMax < baseMin)
            return null;
        if (type == FLOOR && overlayMin > baseMax)
            return null;

        // look for the next point by position, and interpolate both curves to find the minimum
        var curveEvent = getNextPoint(lastPos, lastSpeed, position, speed);
        var speedDelta = curveEvent.overlaySpeed - curveEvent.baseSpeed;
        // if the constraint is a ceiling and the overlay is still the minimum, it's all good
        if (type == CEILING && speedDelta < 0)
            return null;
        // if the constraint is a floor and the overlay is still the maximum, it's all good
        if (type == FLOOR && speedDelta > 0)
            return null;

        // if the curves intersect exactly at the next point, use some simplifications
        if (Math.abs(speedDelta) < 1e-8) {
            if (curveEvent.kind != NextPointKind.BASE_POINT)
                return new EnvelopePoint(position, speed);
            return new EnvelopePoint(curveEvent.pointPosition, curveEvent.overlaySpeed);
        }

        // otherwise, find the intersection point the hard way
        return EnvelopePhysics.intersectSteps(
                lastPos, lastSpeed, position, speed,
                cursor.getStepBeginPos(), cursor.getStepBeginSpeed(),
                cursor.getStepEndPos(), cursor.getStepEndSpeed()
        );
    }

    // endregion


    private EnvelopePoint handleNewPart(double lastOverlayPos, double lastOverlaySpeed, double position, double speed) {
        var partStart = cursor.getStepBeginPos();
        var partStartSpeed = cursor.getStepBeginSpeed();
        var overlaySpeed = EnvelopePhysics.interpolateStepSpeed(
                lastOverlayPos, position,
                lastOverlaySpeed, speed,
                partStart - lastOverlayPos
        );

        if (type == CEILING && partStartSpeed > overlaySpeed)
            return null;
        if (type == FLOOR && partStartSpeed < overlaySpeed)
            return null;

        return new EnvelopePoint(partStart, overlaySpeed);
    }

    @Override
    public EnvelopePoint stepCheck(double lastOverlayPos, double lastOverlaySpeed, double position, double speed) {
        while (cursor.comparePos(position, cursor.getStepBeginPos()) > 0) {
            // attempt to find an intersection
            var inter = intersect(lastOverlayPos, lastOverlaySpeed, position, speed);
            if (inter != null)
                return inter;

            var stepEndPos = cursor.getStepEndPos();
            if (cursor.comparePos(position, stepEndPos) < 0)
                break;

            var stepRes = cursor.nextStep();

            // if stepping resulted in switching to a new base part, check if the first point of the
            // envelope part starts over the overlay
            if (stepRes == NEXT_PART) {
                inter = handleNewPart(lastOverlayPos, lastOverlaySpeed, position, speed);
                if (inter != null)
                    return inter;
            }

            // if the overlay steps ends after the curve, cut it
            if (stepRes == NEXT_REACHED_END) {
                var interSpeed = EnvelopePhysics.interpolateStepSpeed(
                        lastOverlayPos, position,
                        lastOverlaySpeed, speed,
                        stepEndPos - lastOverlayPos
                );
                return new EnvelopePoint(stepEndPos, interSpeed);
            }
        }

        // no intersection with the base curve was found
        return null;
    }
}
