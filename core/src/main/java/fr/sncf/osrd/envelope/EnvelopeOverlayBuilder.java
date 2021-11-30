package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeOverlayBuilder.NextResult.*;

import java.util.ArrayList;

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
public abstract class EnvelopeOverlayBuilder implements StepConsumer {
    private enum Mode {
        /** Envelope parts are copied to the result */
        SCANNING,
        /** New points are added over the current curve */
        OVERLAYING,
        /** The builder reached the end of the base */
        COMPLETE,
    }

    /** The result of the build */
    private final ArrayList<EnvelopePart> resultParts = new ArrayList<>();

    /** What the builder is currently up to */
    private Mode mode = Mode.SCANNING;
    /** The currently being built overlay envelope part, if mode == OVERLAYING */
    private EnvelopePartBuilder overlayPartBuilder = null;
    private double lastOverlayPos = Double.NaN;
    private double lastOverlaySpeed = Double.NaN;

    /** If the base part only partially reflects in the output */
    private int basePartStartIndex = -1;
    /** @see #basePartStartIndex */
    private double basePartStartPosition = Double.NaN;

    /** The envelope this overlay builds over */
    protected final Envelope base;
    /** The current part of the envelope */
    protected EnvelopePart part;

    /** The index of part inside the base envelope */
    protected int partIndex;
    /** The current index inside part */
    protected int stepIndex;

    protected EnvelopeOverlayBuilder(Envelope base) {
        this.base = base;
        this.partIndex = initialPartIndex();
        this.part = base.get(this.partIndex);
        this.stepIndex = initialStepIndex(this.part);
    }

    public static ForwardOverlayBuilder forward(Envelope base) {
        return new ForwardOverlayBuilder(base);
    }

    public static BackwardOverlayBuilder backward(Envelope base) {
        return new BackwardOverlayBuilder(base);
    }

    /** Creates an overlay builder following the given direction */
    public static EnvelopeOverlayBuilder withDirection(Envelope base, boolean reverse) {
        if (reverse)
            return backward(base);
        return forward(base);
    }

    protected abstract int initialPartIndex();

    protected abstract int initialStepIndex(EnvelopePart part);

    protected abstract EnvelopePart smartSlice(
            int beginStepIndex, double beginPosition,
            int endStepIndex, double endPosition
    );

    protected abstract int nextPartIndex();

    protected abstract int nextStepIndex();

    protected abstract double getBaseStepBegin();

    protected abstract double getBaseStepEnd();

    protected abstract double getBaseStepBeginSpeed();

    protected abstract double getBaseStepEndSpeed();

    protected abstract double dirCmp(double a, double b);

    protected abstract Envelope makeEnvelope(EnvelopePart[] parts);

    protected abstract EnvelopePart buildEnvelopePart(EnvelopePartBuilder builder);

    private EnvelopePart pushSlice(int endStepIndex, double endPosition) {
        var sliced = smartSlice(basePartStartIndex, basePartStartPosition, endStepIndex, endPosition);
        if (sliced != null)
            resultParts.add(sliced);
        basePartStartIndex = -1;
        basePartStartPosition = Double.NaN;
        return sliced;
    }

    // region ITERATION

    public enum NextResult {
        NEXT_STEP,
        NEXT_PART,
        NEXT_REACHED_END,
    }

    private NextResult nextPart() {
        if (mode == Mode.COMPLETE)
            return NEXT_REACHED_END;

        if (mode == Mode.SCANNING)
            pushSlice(-1, Double.POSITIVE_INFINITY);

        partIndex = nextPartIndex();
        if (partIndex == -1) {
            stepIndex = -1;
            mode = Mode.COMPLETE;
            return NEXT_REACHED_END;
        }
        part = base.get(partIndex);
        stepIndex = initialStepIndex(part);
        return NEXT_PART;
    }

    private NextResult nextStep() {
        if (mode == Mode.COMPLETE)
            return NEXT_REACHED_END;

        assert partIndex != -1;
        assert stepIndex != -1;
        stepIndex = nextStepIndex();
        if (stepIndex == -1)
            return nextPart();
        return NEXT_STEP;
    }

    /**
     * Scan until the step which contains position
     * @return whether the step was found
     */
    private boolean scanUntil(double position) {
        if (mode == Mode.COMPLETE)
            return false;
        // skip while the current step is strictly before the given position
        while (dirCmp(getBaseStepEnd(), position) <= 0)
            if (nextStep() == NEXT_REACHED_END)
                return false;
        assert dirCmp(position, getBaseStepBegin()) >= 0 && dirCmp(position, getBaseStepEnd()) <= 0;
        return true;
    }

    // endregion

    // region INTERSECTION

    private enum EventKind {
        /** The base has a point at this position */
        BASE_POINT,
        /** The overlay has a point at this position */
        OVERLAY_POINT,
        /** Both the base and the overlay curves have a point at this position */
        BOTH_POINTS,
    }

    private static final class Event {
        EventKind kind;
        double eventPosition;
        double baseSpeed;
        double overlaySpeed;
    }

    private Event getCurvesAtNextPoint(double overlayPos, double overlaySpeed) {
        var res = new Event();
        // two possible cases:
        //  - either the overlay step ends first, and interpolation needs
        //    to be performed on the base curve side
        //  - the base curve step ends first, and interpolation has to be
        //    performed on the overlay step
        var baseStepEnd = getBaseStepEnd();
        var delta = dirCmp(overlayPos, baseStepEnd);
        if (delta == 0.0) {
            res.kind = EventKind.BOTH_POINTS;
            res.eventPosition = overlayPos;
            res.baseSpeed = getBaseStepEndSpeed();
            res.overlaySpeed = overlaySpeed;
        } else if (delta < 0) {
            // the overlay point comes first, interpolate on the base
            res.kind = EventKind.OVERLAY_POINT;
            res.eventPosition = overlayPos;
            var baseBeginPos = part.getBeginPos(stepIndex);
            res.baseSpeed = EnvelopePhysics.interpolateStepSpeed(
                    baseBeginPos,
                    part.getEndPos(stepIndex),
                    part.getBeginSpeed(stepIndex),
                    part.getEndSpeed(stepIndex),
                    overlayPos - baseBeginPos
            );
            res.overlaySpeed = overlaySpeed;
        } else {
            // the base point comes first, interpolate on the overlay
            res.kind = EventKind.BASE_POINT;
            res.eventPosition = baseStepEnd;
            res.baseSpeed = getBaseStepEndSpeed();
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
        if (Math.min(getBaseStepEndSpeed(), getBaseStepBeginSpeed()) > Math.max(lastOverlaySpeed, speed))
            return false;

        // look for the next point by position, and interpolate both curves to find the minimum
        var curveEvent = getCurvesAtNextPoint(position, speed);
        var speedDelta = curveEvent.overlaySpeed - curveEvent.baseSpeed;
        // if the overlay is still the minimum, all is good
        if (speedDelta < 0)
            return false;

        // if the curves intersect exactly at the next point, use some simplifications
        if (speedDelta == 0.0) {
            if (curveEvent.kind != EventKind.BASE_POINT) {
                internalAddOverlayStep(position, speed, time);
                completeOverlay();
                return true;
            }
            // curveEvent.kind == EventKind.BASE_POINT
            // if the curves intersect at a point from the base curve, the step time needs recalculating
            var interTime = EnvelopePhysics.interpolateStepTime(
                    lastOverlayPos, position,
                    lastOverlaySpeed, speed,
                    curveEvent.eventPosition - lastOverlayPos
            );
            internalAddOverlayStep(curveEvent.eventPosition, curveEvent.overlaySpeed, interTime);
            completeOverlay();
            return true;
        }

        // otherwise, find the intersection point the hard way
        var inter = EnvelopePhysics.intersectSteps(
                lastOverlayPos, lastOverlaySpeed, position, speed,
                getBaseStepBegin(), getBaseStepBeginSpeed(),
                getBaseStepEnd(), getBaseStepEndSpeed()
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

    private void startOverlay(
            EnvelopePartMeta meta,
            boolean physicallyAccurate,
            double startPosition,
            double startSpeed
    ) {
        assert mode == Mode.SCANNING;
        assert overlayPartBuilder == null;
        mode = Mode.OVERLAYING;
        overlayPartBuilder = new EnvelopePartBuilder(meta, physicallyAccurate, startPosition, startSpeed);
        lastOverlayPos = startPosition;
        lastOverlaySpeed = startSpeed;
    }

    /** Starts an overlay at the given position, keeping the envelope continuous */
    public void startContinuousOverlay(
            EnvelopePartMeta meta,
            boolean physicallyAccurate,
            double startPosition
    ) {
        if (!scanUntil(startPosition))
            throw new RuntimeException("stepped outside of the curve");
        double startSpeed;
        var basePartSlice = pushSlice(stepIndex, startPosition);
        if (basePartSlice == null)
            startSpeed = part.interpolateSpeed(stepIndex, startPosition);
        else
            startSpeed = basePartSlice.getEndSpeed();
        startOverlay(meta, physicallyAccurate, startPosition, startSpeed);
    }

    private void completeOverlay() {
        assert mode == Mode.OVERLAYING;

        // add the overlay part
        resultParts.add(buildEnvelopePart(overlayPartBuilder));

        // setup slicing of the next base part
        basePartStartIndex = stepIndex;
        basePartStartPosition = lastOverlayPos;

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
        var partStart = getBaseStepBegin();
        var partStartSpeed = getBaseStepBeginSpeed();
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
        assert mode == Mode.OVERLAYING;
        assert dirCmp(lastOverlayPos, getBaseStepBegin()) >= 0 && dirCmp(lastOverlayPos, getBaseStepEnd()) <= 0;
        assert dirCmp(lastOverlayPos, position) < 0;

        while (dirCmp(position, getBaseStepBegin()) > 0) {
            // attempt to find an intersection
            if (intersect(position, speed, time))
                return true;

            if (dirCmp(position, getBaseStepEnd()) < 0)
                break;

            // if stepping resulted in switching to a new base part, check if the first point of the
            // envelope part starts over the overlay
            if (nextStep() == NEXT_PART) {
                if (handleNewPart(position, speed))
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
        assert mode == Mode.SCANNING;

        // add all the remaining base parts to the result
        while (nextPart() != NEXT_REACHED_END)
            continue;

        // build the final envelope
        return makeEnvelope(resultParts.toArray(new EnvelopePart[0]));
    }
}
