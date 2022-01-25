package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.NEXT_PART;
import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.NEXT_REACHED_END;
import static fr.sncf.osrd.envelope.EnvelopePhysics.interpolateStepTime;
import static fr.sncf.osrd.envelope.EnvelopePhysics.intersectStepWithSpeed;

import fr.sncf.osrd.utils.CmpOperator;

/** Creates an envelope part which always keeps a speed lower than a given envelope */
public class OverlayEnvelopePartBuilder implements StepConsumer {
    /** This cursor is updated as the overlay is built. It must not be modified elsewhere until build is called */
    public final EnvelopeCursor cursor;

    /** The maximum / minimum speed allowed for this overlay, or NaN. */
    private double speedThreshold = Double.NaN;
    /** How to compare the overlay speed to the threshold speed. */
    private CmpOperator speedThresholdOperator = null;

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
        var initialPosition = cursor.getPosition();
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

        assert initialSpeed <= cursor.getSpeed();
        return new OverlayEnvelopePartBuilder(cursor, meta, initialSpeed);
    }

    /** Starts an overlay at the given position, keeping the envelope continuous */
    public static OverlayEnvelopePartBuilder startContinuousOverlay(EnvelopeCursor cursor, EnvelopePartMeta meta) {
        return startDiscontinuousOverlay(cursor, meta, cursor.getSpeed());
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

    /**
     * Intersects the base curve with the overlay curve.
     * It takes the overlay step data, and adds the intersection point if any.
     * @return Whether an intersection occurred
     */
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
            if (curveEvent.kind != NextPointKind.BASE_POINT)
                return addOverlayStep(position, speed, time, StepKind.BASE_INTERSECTION);
            // curveEvent.kind == EventKind.BASE_POINT
            // if the curves intersect at a point from the base curve, the step time needs recalculating
            var interTime = interpolateStepTime(
                    lastOverlayPos, position,
                    lastOverlaySpeed, speed,
                    curveEvent.pointPosition - lastOverlayPos
            );
            assert interTime != 0.0;
            return addOverlayStep(
                    curveEvent.pointPosition,
                    curveEvent.overlaySpeed,
                    interTime,
                    StepKind.BASE_INTERSECTION
            );
        }

        // otherwise, find the intersection point the hard way
        var inter = EnvelopePhysics.intersectSteps(
                lastOverlayPos, lastOverlaySpeed, position, speed,
                cursor.getStepBeginPos(), cursor.getStepBeginSpeed(),
                cursor.getStepEndPos(), cursor.getStepEndSpeed()
        );
        var stepTime = interpolateStepTime(
                lastOverlayPos, position, lastOverlaySpeed, speed,
                inter.position - lastOverlayPos
        );
        return addOverlayStep(inter.position, inter.speed, stepTime, StepKind.BASE_INTERSECTION);
    }

    // endregion

    // region OVERLAY

    private enum StepKind {
        INTERMEDIATE(false, false),
        BASE_INTERSECTION(true, true),
        THRESHOLD_INTERSECTION(true, true),
        FINAL(false, true);

        public final boolean isIntersection;
        public final boolean isLastPoint;

        StepKind(boolean isIntersection, boolean isLastPoint) {
            this.isIntersection = isIntersection;
            this.isLastPoint = isLastPoint;
        }
    }

    /** Return whether this step had an intersection */
    private boolean addOverlayStep(double position, double speed, double time, StepKind kind) {
        if (hasSpeedThreshold() && CmpOperator.compare(speed, speedThresholdOperator, speedThreshold)) {
            position = intersectStepWithSpeed(lastOverlayPos, lastOverlaySpeed, position, speed, speedThreshold);
            speed = speedThreshold;
            time = interpolateStepTime(lastOverlayPos, position, lastOverlaySpeed, speed);
            kind = StepKind.THRESHOLD_INTERSECTION;
        }

        partBuilder.addStep(position, speed, time);
        lastOverlaySpeed = speed;
        lastOverlayPos = position;

        hadIntersection = kind.isIntersection;

        if (kind.isLastPoint && !cursor.hasReachedEnd())
            cursor.findPosition(position);
        return kind.isLastPoint;
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

        var interTime = interpolateStepTime(
                lastOverlayPos, position,
                lastOverlaySpeed, speed,
                partStart - lastOverlayPos
        );

        return addOverlayStep(partStart, overlaySpeed, interTime, StepKind.FINAL);
    }

    public boolean hasSpeedThreshold() {
        return !Double.isNaN(speedThreshold);
    }

    /** Adds a speed threshold which stops the overlay */
    public void addSpeedThreshold(double speed, CmpOperator operator) {
        assert !operator.strict;
        this.speedThreshold = speed;
        this.speedThresholdOperator = operator;
    }

    @Override
    public boolean addStep(double position, double speed) {
        assert !hadIntersection : "called addStep on a complete overlay";
        var time = interpolateStepTime(
                lastOverlayPos, position,
                lastOverlaySpeed, speed
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
                var interTime = interpolateStepTime(
                        lastOverlayPos, position,
                        lastOverlaySpeed, speed,
                        stepEndPos - lastOverlayPos
                );
                return addOverlayStep(stepEndPos, interSpeed, interTime, StepKind.FINAL);
            }
        }

        // if no intersection with the base curve was found, add the step to the overlay
        return addOverlayStep(position, speed, time, StepKind.INTERMEDIATE);
    }

    /**
     * Maintains the current speed until an intersection or the end of the curve is found
     * @return Whether an intersection occurred. If not, the end of the envelope was reached.
     */
    public boolean addPlateau() {
        assert !hadIntersection : "called addStep on a complete overlay";
        assert cursor.comparePos(lastOverlayPos, cursor.getStepBeginPos()) >= 0
                && cursor.comparePos(lastOverlayPos, cursor.getStepEndPos()) <= 0;

        var hasNotReachedEnd = cursor.findSpeed(lastOverlaySpeed, CmpOperator.STRICTLY_LOWER);
        assert hasNotReachedEnd != cursor.hasReachedEnd();
        double position;
        if (hasNotReachedEnd)
            position = cursor.getPosition();
        else
            position = cursor.getEnvelopeEndPos();

        var plateauLength = Math.abs(position - lastOverlayPos);
        var plateauDuration = plateauLength / lastOverlaySpeed;
        var stepKind = hasNotReachedEnd ? StepKind.BASE_INTERSECTION : StepKind.FINAL;
        return addOverlayStep(position, lastOverlaySpeed, plateauDuration, stepKind);
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
