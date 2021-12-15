package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.*;

import java.util.ArrayList;
import java.util.Collections;

/**
 * <p>An envelope overlay takes a continuous envelope as an input,
 * scans it from beginning to end, producing a new one.</p>
 *
 * <p>When a new point is added, the following algorithm runs:</p>
 * <pre>
 *   for all base steps which have an intersecting range with the new step:
 *       if the new step keeps being the minimum for all its length:
 *           continue
 *       inter = intersection between base step and new step
 *       add the intersection point to the overlay part
 *       end the overlay part
 *       switch to the scanning mode
 *       remember the intersection point with the base envelope
 *       return true
 *   add the new point to the curve
 *   returns whether the tip of the new step touches the base curve
 * </pre>
 */
public final class EnvelopeOverlayBuilder implements StepConsumer {
    private enum Mode {
        /** Envelope parts are copied to the result */
        SCANNING,
        /** New points are added over the current curve */
        OVERLAYING,
    }

    /** Holds the current position inside the envelope */
    public final EnvelopeCursor cursor;
    /** The expected revision of the cursor */
    private int cursorRevision;

    /** What the builder is currently up to */
    private Mode mode = Mode.SCANNING;

    // region OVERLAY_FIELDS
    /** The currently being built overlay envelope part, if mode == OVERLAYING */
    private EnvelopePartBuilder overlayPartBuilder = null;
    private double lastOverlayPos = Double.NaN;
    private double lastOverlaySpeed = Double.NaN;
    // endregion

    // region SCAN_FIELDS
    private int lastOverlayEndPartIndex = -1;
    private int lastOverlayEndStepIndex = -1;
    private double lastOverlayEndPosition = Double.NaN;
    // endregion

    /** The result of the build */
    private final ArrayList<EnvelopePart> resultParts = new ArrayList<>();

    public EnvelopeOverlayBuilder(EnvelopeCursor cursor) {
        this.cursor = cursor;
        this.cursorRevision = cursor.getRevision();
    }

    public static EnvelopeOverlayBuilder withDirection(Envelope base, boolean reverse) {
        return new EnvelopeOverlayBuilder(new EnvelopeCursor(base, reverse));
    }

    public static EnvelopeOverlayBuilder forward(Envelope base) {
        return new EnvelopeOverlayBuilder(new EnvelopeCursor(base, false));
    }

    public static EnvelopeOverlayBuilder backward(Envelope base) {
        return new EnvelopeOverlayBuilder(new EnvelopeCursor(base, true));
    }

    void checkMode(Mode expectedMode) {
        if (mode == expectedMode)
            return;
        throw new RuntimeException("unexpected mode");
    }

    private void sliceBaseEnvelope() {
        // cut the base envelope from the end of the last overlay to the current position, which is either
        // the end of the envelope or the start of another overlay
        EnvelopePart[] sliced;
        if (cursor.hasReachedEnd()) {
            sliced = cursor.smartSlice(
                    lastOverlayEndPartIndex, lastOverlayEndStepIndex, lastOverlayEndPosition,
                    -1, -1, Double.NaN
            );
        } else {
            sliced = cursor.smartSlice(
                    lastOverlayEndPartIndex, lastOverlayEndStepIndex, lastOverlayEndPosition,
                    cursor.getPartIndex(), cursor.getStepIndex(), cursor.getPosition()
            );
        }

        // add these to the result
        if (cursor.reverse)
            for (int i = sliced.length - 1; i >= 0; i--)
                resultParts.add(sliced[i]);
        else
            Collections.addAll(resultParts, sliced);
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
                internalAddOverlayStep(position, speed, time);
                completeOverlay();
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
            internalAddOverlayStep(curveEvent.pointPosition, curveEvent.overlaySpeed, interTime);
            completeOverlay();
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
        internalAddOverlayStep(inter.position, inter.speed, stepTime);
        completeOverlay();
        return true;
    }

    // endregion

    // region OVERLAY

    private void startOverlay(EnvelopePartMeta meta, double startPosition, double startSpeed) {
        checkMode(Mode.SCANNING);
        assert overlayPartBuilder == null;
        mode = Mode.OVERLAYING;
        overlayPartBuilder = new EnvelopePartBuilder(meta, startPosition, startSpeed);
        lastOverlayPos = startPosition;
        lastOverlaySpeed = startSpeed;
    }

    /** Starts an overlay at the given position and speed */
    public void startDiscontinuousOverlay(EnvelopePartMeta meta, double startSpeed) {
        checkMode(Mode.SCANNING);
        sliceBaseEnvelope();
        startOverlay(meta, cursor.getPosition(), startSpeed);
    }

    /** Starts an overlay at the given position, keeping the envelope continuous */
    public double startContinuousOverlay(EnvelopePartMeta meta) {
        checkMode(Mode.SCANNING);

        sliceBaseEnvelope();

        var startSpeed = cursor.interpolateSpeed();
        var startPosition = cursor.getPosition();

        // when a continuous overlay starts at a discontinuity, avoid checking for intersection with the last point of
        // the current part by moving to the next part.
        if (cursor.startsDiscontinuity()) {
            cursor.nextPart();
            // Starting a continuous overlay at a discontinuity only makes sense when the next part starts at a lower
            // speed than the end of the previous one. Otherwise, the overlay will always immediately hit a wall.
            assert startSpeed < cursor.interpolateSpeed();
            assert startPosition == cursor.getPosition();
        }

        startOverlay(meta, startPosition, startSpeed);
        return startSpeed;
    }

    private void completeOverlay() {
        checkMode(Mode.OVERLAYING);

        // add the overlay part
        if (cursor.reverse)
            overlayPartBuilder.reverse();
        resultParts.add(overlayPartBuilder.build());

        // setup slicing of the next base part
        lastOverlayEndPartIndex = cursor.getPartIndex();
        lastOverlayEndStepIndex = cursor.getStepIndex();
        lastOverlayEndPosition = lastOverlayPos;

        // reset internal state
        overlayPartBuilder = null;
        lastOverlayPos = Double.NaN;
        lastOverlaySpeed = Double.NaN;
        mode = Mode.SCANNING;
    }

    private void internalAddOverlayStep(double position, double speed, double time) {
        overlayPartBuilder.addStep(position, speed, time);
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

        internalAddOverlayStep(partStart, overlaySpeed, interTime);
        completeOverlay();
        return true;
    }

    @Override
    public boolean addStep(double position, double speed) {
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
        checkMode(Mode.OVERLAYING);
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
                internalAddOverlayStep(stepEndPos, interSpeed, interTime);
                completeOverlay();
                return true;
            }
        }

        // if no intersection with the base curve was found, add the step to the overlay
        internalAddOverlayStep(position, speed, time);
        return false;
    }

    // endregion

    /** Create the envelope */
    public Envelope build() {
        checkMode(Mode.SCANNING);

        cursor.moveToEnd();
        sliceBaseEnvelope();

        // build the final envelope
        EnvelopePart[] parts = resultParts.toArray(new EnvelopePart[0]);
        if (cursor.reverse) {
            for (int i = 0; i < parts.length / 2; i++) {
                var tmp = parts[i];
                parts[i] = parts[parts.length - i - 1];
                parts[parts.length - i - 1] = tmp;
            }
        }
        return Envelope.make(parts);
    }
}
