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

    /** The time from the start of the envelope to envelope part transitions, in milliseconds.
     *  Only read using getTotalTimes.
     */
    private long[] cumulativeTimesCache = null;

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
        return Math.abs(prevPos - nextPos) < 1E-10;
    }

    public static boolean areSpeedContinuous(double prevPos, double prevSpeed, double nextPos, double nextSpeed) {
        return Math.abs(prevSpeed - nextSpeed) < 1E-10;
    }

    // endregion

    // region GETTERS

    public int size() {
        return parts.length;
    }

    public EnvelopePart get(int i) {
        return parts[i];
    }

    public double getBeginPos() {
        return parts[0].getBeginPos();
    }

    public double getEndPos() {
        return parts[parts.length - 1].getEndPos();
    }

    public double getBeginSpeed() {
        return parts[0].getBeginSpeed();
    }

    public double getEndSpeed() {
        return parts[parts.length - 1].getEndSpeed();
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

    /** Returns the first envelope part which contains this position. */
    public int findEnvelopePartIndexLeft(double position) {
        for (int i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (position >= part.getBeginPos() && position <= part.getEndPos())
                return i;
        }
        return -1;
    }

    /** Returns the last envelope part which contains this position. */
    public int findEnvelopePartIndexRight(double position) {
        for (int i = parts.length - 1; i >= 0; i--) {
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
    public long interpolateTotalTimeMS(double position) {
        assert continuous : "interpolating times on a non continuous envelope is a risky business";
        var envelopePartIndex = findEnvelopePartIndex(position);
        assert envelopePartIndex != -1;
        var envelopePart = get(envelopePartIndex);
        var stepIndex = envelopePart.findStep(position);
        return getCumulativeTimeMS(envelopePartIndex) + envelopePart.interpolateTotalTimeMS(stepIndex, position);
    }

    /** Computes the time required to get to a given point of the envelope */
    public double interpolateTotalTime(double position) {
        return ((double) interpolateTotalTimeMS(position)) / 1000;
    }

    // endregion

    // region CACHING

    /** This method must be private as it returns an array */
    private long[] getCumulativeTimesMS() {
        if (cumulativeTimesCache != null)
            return cumulativeTimesCache;

        var timesToPartTransitions = new long[parts.length + 1];
        timesToPartTransitions[0] = 0;

        long totalTime = 0;
        for (int i = 0; i < parts.length; i++) {
            totalTime += parts[i].getTotalTimeMS();
            timesToPartTransitions[i + 1] = totalTime;
        }
        cumulativeTimesCache = timesToPartTransitions;
        return timesToPartTransitions;
    }

    /** Returns the total time of the envelope, in milliseconds */
    public long getTotalTimeMS() {
        var timesToPartTransitions = getCumulativeTimesMS();
        return timesToPartTransitions[timesToPartTransitions.length - 1];
    }

    /** Returns the total time of the envelope */
    public double getTotalTime() {
        return ((double) getTotalTimeMS()) / 1000;
    }


    /** Returns the total time required to get from the start of the envelope to
     * the start of an envelope part, in milliseconds
     * @param transitionIndex either an envelope part index, of the number of parts to get the total time
     */
    public long getCumulativeTimeMS(int transitionIndex) {
        return getCumulativeTimesMS()[transitionIndex];
    }

    // endregion

    // region SLICING

    /** Cuts an envelope, interpolating new points if required.
     * @return a list of envelope parts spanning from beginPosition to endPosition
     */
    public EnvelopePart[] slice(double beginPosition, double endPosition) {
        return slice(beginPosition, Double.NaN, endPosition, Double.NaN);
    }

    /** Cuts an envelope, interpolating new points if required.
     * @return a list of envelope parts spanning from beginPosition to endPosition
     */
    public EnvelopePart[] slice(double beginPosition, double beginSpeed, double endPosition, double endSpeed) {
        int beginIndex = 0;
        var beginPartIndex = 0;
        if (beginPosition != Double.NEGATIVE_INFINITY) {
            beginPartIndex = findEnvelopePartIndex(beginPosition);
            var beginPart = parts[beginPartIndex];
            beginIndex = beginPart.findStep(beginPosition);
        }
        var endPartIndex = parts.length - 1;
        var endPart = parts[endPartIndex];
        int endIndex = endPart.stepCount() - 1;
        if (endPosition != Double.POSITIVE_INFINITY) {
            endPartIndex = findEnvelopePartIndex(endPosition);
            endPart = parts[endPartIndex];
            endIndex = endPart.findStep(endPosition);
        }
        return slice(beginPartIndex, beginIndex, beginPosition, beginSpeed,
                endPartIndex, endIndex, endPosition, endSpeed);
    }

    /** Cuts an envelope */
    public EnvelopePart[] slice(
            int beginPartIndex, int beginStepIndex, double beginPosition, double beginSpeed,
            int endPartIndex, int endStepIndex, double endPosition, double endSpeed
    ) {
        assert beginPartIndex <= endPartIndex;

        if (beginPartIndex == endPartIndex) {
            var part = parts[beginPartIndex];
            var sliced = part.slice(beginStepIndex, beginPosition, beginSpeed, endStepIndex, endPosition, endSpeed);
            if (sliced == null)
                return new EnvelopePart[] {};
            return new EnvelopePart[] { sliced };
        }

        var beginPart = parts[beginPartIndex];
        var endPart = parts[endPartIndex];
        var beginPartSliced = beginPart.sliceEnd(beginStepIndex, beginPosition, beginSpeed);
        var endPartSliced = endPart.sliceBeginning(endStepIndex, endPosition, endSpeed);

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
            int beginPartIndex, int beginStepIndex, double beginPosition, double beginSpeed,
            int endPartIndex, int endStepIndex, double endPosition, double endSpeed
    ) {
        if (beginPartIndex == -1) {
            beginPartIndex = 0;
            var beginPart = parts[beginPartIndex];
            beginStepIndex = 0;
            beginPosition = beginPart.getBeginPos();
            beginSpeed = beginPart.getBeginSpeed();
        }
        if (endPartIndex == -1) {
            endPartIndex = parts.length - 1;
            var endPart = parts[endPartIndex];
            endStepIndex = endPart.stepCount() - 1;
            endPosition = endPart.getEndPos();
            endSpeed = endPart.getEndSpeed();
        }
        return slice(
                beginPartIndex, beginStepIndex, beginPosition, beginSpeed,
                endPartIndex, endStepIndex, endPosition, endSpeed
        );
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