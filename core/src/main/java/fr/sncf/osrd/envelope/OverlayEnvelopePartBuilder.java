package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.NEXT_PART;
import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.NEXT_REACHED_END;

/** Creates an envelope part which always keeps a speed lower than a given envelope */
public class OverlayEnvelopePartBuilder implements StepConsumer {
    /** This cursor is updated as the overlay is built. It must not be modified elsewhere until build is called */
    public final EnvelopeCursor cursor;

    /** The part index of the starting point of the overlay */
    public final int initialPartIndex;
    /** The step index of the starting point of the overlay */
    public final int initialStepIndex;
    /** The position of the starting point of the overlay */
    public final double initialPosition;

    /** The position of the last added point */
    private double lastOverlayPos;
    /** The speed of the last added point */
    private double lastOverlaySpeed;

    /** Once an intersection occurred, points cannot be added anymore */
    private boolean hadIntersection = false;

    /** This builder is used until set to null by build() to prevent reuse */
    private EnvelopePartBuilder partBuilder;

    private OverlayEnvelopePartBuilder(EnvelopeCursor cursor, EnvelopePartMeta meta, double initialSpeed) {
        this.cursor = cursor;
        this.initialPartIndex = cursor.getPartIndex();
        this.initialStepIndex = cursor.getStepIndex();
        this.initialPosition = cursor.getPosition();
        this.partBuilder = new EnvelopePartBuilder(meta, initialPosition, initialSpeed);
        this.lastOverlayPos = initialPosition;
        this.lastOverlaySpeed = initialSpeed;
    }

    /** Starts an overlay at the given position and speed */
    public static OverlayEnvelopePartBuilder startDiscontinuousOverlay(
            EnvelopeCursor cursor,
            EnvelopePartMeta meta,
            double initialSpeed
    ) {
        var startPosition = cursor.getPosition();

        // when an overlay starts on a point, avoid checking for intersection
        if (cursor.getPosition() == cursor.getStepEndPos()) {
            var nextRes = cursor.nextStep();
            assert startPosition == cursor.getPosition();
            assert nextRes != NEXT_REACHED_END;
        }

        assert initialSpeed <= cursor.interpolateSpeed();
        return new OverlayEnvelopePartBuilder(cursor, meta, initialSpeed);
    }

    /** Starts an overlay at the given position, keeping the envelope continuous */
    public static OverlayEnvelopePartBuilder startContinuousOverlay(EnvelopeCursor cursor, EnvelopePartMeta meta) {
        return startDiscontinuousOverlay(cursor, meta, cursor.interpolateSpeed());
    }

    public double getLastPos() {
        return lastOverlayPos;
    }

    public double getLastSpeed() {
        return lastOverlaySpeed;
    }

    public boolean getHadIntersection() {
        return hadIntersection;
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
    private NextPoint getNextPoint(double overlayPos, double overlaySpeed) {
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

    /** This is called when the overlay ends without an intersection with the base curve */
    private void addFinalStep(double position, double speed, double stepTime) {
        if (!cursor.hasReachedEnd())
            cursor.findPosition(position);
        addOverlayStep(position, speed, stepTime);
    }

    /** This is called when the overlay intersects with the base curve */
    private void addIntersectionStep(double position, double speed, double stepTime) {
        cursor.findPosition(position);
        addOverlayStep(position, speed, stepTime);
        hadIntersection = true;
    }

    private boolean intersect(double position, double speed, double time) {
        // if the speed ranges do not even intersect, there is no intersection
        var baseMin = Math.min(cursor.getStepEndSpeed(), cursor.getStepBeginSpeed());
        var overlayMax = Math.max(lastOverlaySpeed, speed);
        if (overlayMax < baseMin)
            return false;

        // look for the next point by position, and interpolate both curves to find the minimum
        var curveEvent = getNextPoint(position, speed);
        var speedDelta = curveEvent.overlaySpeed - curveEvent.baseSpeed;
        // if the overlay is still the minimum, all is good
        if (speedDelta < 0)
            return false;

        // if the curves intersect exactly at the next point, use some simplifications
        if (speedDelta == 0.0) {
            if (curveEvent.kind != NextPointKind.BASE_POINT) {
                addIntersectionStep(position, speed, time);
                return true;
            }
            // curveEvent.kind == EventKind.BASE_POINT
            // if the curves intersect at a point from the base curve, the step time needs recalculating
            var interTime = EnvelopePhysics.interpolateStepTime(
                    lastOverlayPos, position,
                    lastOverlaySpeed, speed,
                    curveEvent.pointPosition - lastOverlayPos
            );
            assert interTime != 0.0;
            addIntersectionStep(curveEvent.pointPosition, curveEvent.overlaySpeed, interTime);
            return true;
        }

        // otherwise, find the intersection point the hard way
        var inter = EnvelopePhysics.intersectSteps(
                lastOverlayPos, lastOverlaySpeed, position, speed,
                cursor.getStepBeginPos(), cursor.getStepBeginSpeed(),
                cursor.getStepEndPos(), cursor.getStepEndSpeed()
        );
        var stepTime = EnvelopePhysics.interpolateStepTime(
                lastOverlayPos, position, lastOverlaySpeed, speed,
                inter.position - lastOverlayPos
        );
        addIntersectionStep(inter.position, inter.speed, stepTime);
        return true;
    }

    // endregion

    // region OVERLAY

    private void addOverlayStep(double position, double speed, double time) {
        partBuilder.addStep(position, speed, time);
        lastOverlaySpeed = speed;
        lastOverlayPos = position;
    }

    private boolean handleNewPart(double position, double speed) {
        var partStart = cursor.getStepBeginPos();
        var partStartSpeed = cursor.getStepBeginSpeed();
        var overlaySpeed = EnvelopePhysics.interpolateStepSpeed(
                lastOverlayPos, position,
                lastOverlaySpeed, speed,
                partStart - lastOverlayPos
        );

        if (partStartSpeed > overlaySpeed)
            return false;

        var interTime = EnvelopePhysics.interpolateStepTime(
                lastOverlayPos, position,
                lastOverlaySpeed, speed,
                partStart - lastOverlayPos
        );

        addFinalStep(partStart, overlaySpeed, interTime);
        return true;
    }

    @Override
    public boolean addStep(double position, double speed) {
        assert !hadIntersection : "called addStep on a complete overlay";
        var time = EnvelopePhysics.interpolateStepTime(
                lastOverlayPos, position,
                lastOverlaySpeed, speed,
                position - lastOverlayPos
        );
        return addStep(position, speed, time);
    }

    /** Adds a new point to the overlay
     * @return whether the overlay collided with is complete
     */
    @Override
    public boolean addStep(double position, double speed, double time) {
        assert !hadIntersection : "called addStep on a complete overlay";
        assert cursor.comparePos(lastOverlayPos, cursor.getStepBeginPos()) >= 0
                && cursor.comparePos(lastOverlayPos, cursor.getStepEndPos()) <= 0;
        assert cursor.comparePos(lastOverlayPos, position) < 0;

        while (cursor.comparePos(position, cursor.getStepBeginPos()) > 0) {
            // attempt to find an intersection
            if (intersect(position, speed, time))
                return true;

            var stepEndPos = cursor.getStepEndPos();
            if (cursor.comparePos(position, stepEndPos) < 0)
                break;

            var stepRes = cursor.nextStep();

            // if stepping resulted in switching to a new base part, check if the first point of the
            // envelope part starts over the overlay
            if (stepRes == NEXT_PART) {
                if (handleNewPart(position, speed))
                    return true;
            }

            // if the overlay steps ends after the curve, cut it
            if (stepRes == NEXT_REACHED_END) {
                var interSpeed = EnvelopePhysics.interpolateStepSpeed(
                        lastOverlayPos, position,
                        lastOverlaySpeed, speed,
                        stepEndPos - lastOverlayPos
                );
                var interTime = EnvelopePhysics.interpolateStepTime(
                        lastOverlayPos, position,
                        lastOverlaySpeed, speed,
                        stepEndPos - lastOverlayPos
                );
                addFinalStep(stepEndPos, interSpeed, interTime);
                return true;
            }
        }

        // if no intersection with the base curve was found, add the step to the overlay
        addOverlayStep(position, speed, time);
        return false;
    }

    // endregion

    /** Create the overlay-ed envelope part, making the builder unusable */
    public EnvelopePart build() {
        // add the overlay part
        if (cursor.reverse)
            partBuilder.reverse();

        var result = partBuilder.build();
        partBuilder = null;
        return result;
    }
}
