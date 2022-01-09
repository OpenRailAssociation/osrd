package fr.sncf.osrd.envelope;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Iterator;
import java.util.NoSuchElementException;


@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class Envelope implements Iterable<EnvelopePart> {
    private final EnvelopePart[] parts;
    public final boolean spaceContinuous;
    public final boolean continuous;

    // region CACHE FIELDS

    // these two fields could be public, but aren't for the sake of keeping the ability to compute these values lazily
    /** The highest speed */
    private final double maxSpeed;
    /** The smallest speed */
    private final double minSpeed;

    /** The time from the start of the envelope, in milliseconds. Only read using getTotalTimes. */
    private long[] timeToPartEndCache = null;

    // endregion

    // region CONSTRUCTORS

    private Envelope(EnvelopePart[] parts, boolean spaceContinuous, boolean continuous) {
        assert parts.length != 0;
        this.parts = parts;
        this.spaceContinuous = spaceContinuous;
        this.continuous = continuous;

        var maxSpeed = Double.NEGATIVE_INFINITY;
        for (var part : parts) {
            var partMaxSpeed = part.getMaxSpeed();
            if (partMaxSpeed > maxSpeed)
                maxSpeed = partMaxSpeed;
        }
        this.maxSpeed = maxSpeed;

        var minSpeed = Double.POSITIVE_INFINITY;
        for (var part : parts) {
            var partMinSpeed = part.getMinSpeed();
            if (partMinSpeed < minSpeed)
                minSpeed = partMinSpeed;
        }
        this.minSpeed = minSpeed;
    }

    /** Create a new Envelope */
    public static Envelope make(EnvelopePart... parts) {
        boolean spaceContinuous = allPartTransitions(Envelope::areSpaceContinuous, parts);
        boolean continuous = spaceContinuous && allPartTransitions(Envelope::areSpeedContinuous, parts);
        return new Envelope(parts, spaceContinuous, continuous);
    }

    /** A predicate which applies to a transition between two points */
    public interface TransitionPredicate {
        boolean test(double prevPos, double prevSpeed, double nextPos, double nextSpeed);
    }

    /** Checks that all transitions between envelope part match a predicate */
    private static boolean allPartTransitions(TransitionPredicate predicate, EnvelopePart[] parts) {
        for (int i = 0; i < parts.length - 1; i++) {
            var prevPart = parts[i];
            var nextPart = parts[i + 1];
            var prevPos = prevPart.getEndPos();
            var prevSpeed = prevPart.getEndSpeed();
            var nextPos = nextPart.getBeginPos();
            var nextSpeed = nextPart.getBeginSpeed();
            if (!predicate.test(prevPos, prevSpeed, nextPos, nextSpeed))
                return false;
        }
        return true;
    }

    public static boolean areSpaceContinuous(double prevPos, double prevSpeed, double nextPos, double nextSpeed) {
        return prevPos == nextPos;
    }

    public static boolean areSpeedContinuous(double prevPos, double prevSpeed, double nextPos, double nextSpeed) {
        return prevSpeed == nextSpeed;
    }

    // endregion

    // region GETTERS

    public int size() {
        return parts.length;
    }

    public EnvelopePart get(int i) {
        return parts[i];
    }

    /** Returns the maximum speed of the envelope */
    public double getMaxSpeed() {
        return maxSpeed;
    }

    /** Returns the minimum speed of the envelope */
    public double getMinSpeed() {
        return minSpeed;
    }

    // endregion


    /** Returns the first envelope part which contains this position. */
    public int findEnvelopePartIndex(double position) {
        for (int i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (position >= part.getBeginPos() && position <= part.getEndPos())
                return i;
        }
        return -1;
    }

    // region INTERPOLATION

    /** Returns the interpolated speed at a given position */
    public double interpolateSpeed(double position) {
        assert continuous : "interpolating speeds on a non continuous envelope is a risky business";
        var envelopePartIndex = findEnvelopePartIndex(position);
        assert envelopePartIndex != -1;
        return get(envelopePartIndex).interpolateSpeed(position);
    }

    /** Computes the time required to get to a given point of the envelope */
    public long interpolateTotalTime(double position) {
        assert continuous : "interpolating times on a non continuous envelope is a risky business";
        var envelopePartIndex = findEnvelopePartIndex(position);
        assert envelopePartIndex != -1;
        var envelopePart = get(envelopePartIndex);
        var stepIndex = envelopePart.findStep(position);
        return getTimeToPartTransition(envelopePartIndex) + envelopePart.interpolateTotalTime(stepIndex, position);
    }

    // endregion

    // region CACHING

    /** This method must be private as it returns an array */
    private long[] getTimesToPartTransitions() {
        if (timeToPartEndCache != null)
            return timeToPartEndCache;

        var timesToPartTransitions = new long[parts.length + 1];
        timesToPartTransitions[0] = 0;

        long totalTime = 0;
        for (int i = 0; i < parts.length; i++) {
            totalTime += parts[i].getTotalTime();
            timesToPartTransitions[i + 1] = totalTime;
        }
        timeToPartEndCache = timesToPartTransitions;
        return timesToPartTransitions;
    }

    /** Returns the total time of the envelope, in milliseconds */
    public long getTotalTime() {
        var timesToPartEnds = getTimesToPartTransitions();
        return timesToPartEnds[timesToPartEnds.length - 1];
    }


    /** Returns the total time required to get from the start of the envelope to
     * the end of an envelope part, in milliseconds
     */
    public long getTimeToPartTransition(int transitionIndex) {
        return getTimesToPartTransitions()[transitionIndex];
    }

    // endregion

    // region SLICING

    /** Cuts an envelope */
    public EnvelopePart[] slice(
            int beginPartIndex, int beginStepIndex, double beginPosition,
            int endPartIndex, int endStepIndex, double endPosition
    ) {
        assert beginPartIndex <= endPartIndex;

        if (beginPartIndex == endPartIndex) {
            var part = parts[beginPartIndex];
            var sliced = part.slice(beginStepIndex, beginPosition, endStepIndex, endPosition);
            if (sliced == null)
                return new EnvelopePart[] {};
            return new EnvelopePart[] { sliced };
        }

        var beginPart = parts[beginPartIndex];
        var endPart = parts[endPartIndex];
        var beginPartSliced = beginPart.sliceEnd(beginStepIndex, beginPosition);
        var endPartSliced = endPart.sliceBeginning(endStepIndex, endPosition);

        // compute the number of unchanged envelope parts between sliced parts
        var copySize = endPartIndex - beginPartIndex + 1 - /* sliced endpoints */ 2;

        // compute the total sliced envelope size
        var size = copySize;
        if (beginPartSliced != null)
            size++;
        if (endPartSliced != null)
            size++;

        var res = new EnvelopePart[size];

        int cur = 0;
        if (beginPartSliced != null)
            res[cur++] = beginPartSliced;

        var copyStartIndex = beginPartIndex + 1;
        for (int i = 0; i < copySize; i++)
            res[cur++] = parts[copyStartIndex + i];

        if (endPartSliced != null)
            res[cur] = endPartSliced;
        return res;
    }

    /** Cuts the envelope */
    public EnvelopePart[] smartSlice(
            int beginPartIndex, int beginStepIndex, double beginPosition,
            int endPartIndex, int endStepIndex, double endPosition
    ) {
        if (beginPartIndex == -1) {
            beginPartIndex = 0;
            var beginPart = parts[beginPartIndex];
            beginStepIndex = 0;
            beginPosition = beginPart.getBeginPos();
        }
        if (endPartIndex == -1) {
            endPartIndex = parts.length - 1;
            var endPart = parts[endPartIndex];
            endStepIndex = endPart.stepCount() - 1;
            endPosition = endPart.getEndPos();
        }
        return slice(beginPartIndex, beginStepIndex, beginPosition, endPartIndex, endStepIndex, endPosition);
    }

    // endregion

    @Override
    public Iterator<EnvelopePart> iterator() {
        return new Iterator<>() {
            private int i = 0;

            @Override
            public boolean hasNext() {
                return i < parts.length;
            }

            @Override
            public EnvelopePart next() {
                if (!hasNext())
                    throw new NoSuchElementException();
                return parts[i++];
            }
        };
    }
}