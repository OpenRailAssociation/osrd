package fr.sncf.osrd.envelope;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Stream;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class Envelope implements Iterable<EnvelopePart>, SearchableEnvelope, EnvelopeInterpolate {
    private final EnvelopePart[] parts;
    public final boolean continuous;

    // region CACHE FIELDS

    /** Contains the position of all transitions, including the beginning and end positions */
    private final double[] partPositions;

    // these two fields could be public, but aren't for the sake of keeping the ability to compute
    // these values lazily
    /** The highest speed */
    private final double maxSpeed;

    /** The smallest speed */
    private final double minSpeed;

    /**
     * The time from the start of the envelope to envelope part transitions, in milliseconds. Only
     * read using getTotalTimes.
     */
    private long[] cumulativeTimesCache = null;

    // endregion

    // region CONSTRUCTORS

    private Envelope(EnvelopePart[] parts) {
        assert parts.length != 0;

        // check for space and speed continuity. space continuity is mandatory, speed continuity is
        // not
        boolean continuous = true;
        for (int i = 0; i < parts.length - 1; i++) {
            if (parts[i].getEndPos() != parts[i + 1].getBeginPos())
                throw new OSRDError(ErrorType.EnvelopePartsNotContiguous);
            if (parts[i].getEndSpeed() != parts[i + 1].getBeginSpeed()) continuous = false;
        }

        // find the minimum and maximum speeds for all envelope parts
        var minSpeed = Double.POSITIVE_INFINITY;
        var maxSpeed = Double.NEGATIVE_INFINITY;
        for (var part : parts) {
            var partMinSpeed = part.getMinSpeed();
            if (partMinSpeed < minSpeed) minSpeed = partMinSpeed;
            var partMaxSpeed = part.getMaxSpeed();
            if (partMaxSpeed > maxSpeed) maxSpeed = partMaxSpeed;
        }

        // fill the part transition positions cache
        var partPositions = new double[parts.length + 1];
        partPositions[0] = parts[0].getBeginPos();
        for (int i = 0; i < parts.length; i++) partPositions[i + 1] = parts[i].getEndPos();
        this.partPositions = partPositions;

        this.parts = parts;
        this.continuous = continuous;
        this.minSpeed = minSpeed;
        this.maxSpeed = maxSpeed;
    }

    /** Create a new Envelope */
    public static Envelope make(EnvelopePart... parts) {
        return new Envelope(parts);
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

    public double getTotalDistance() {
        return getEndPos() - getBeginPos();
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

    // region SEARCH

    @Override
    public int binarySearchPositions(double position) {
        return Arrays.binarySearch(partPositions, position);
    }

    @Override
    public int positionPointsCount() {
        return partPositions.length;
    }

    // endregion

    // region INTERPOLATION

    /** Returns the interpolated speed at a given position. Assumes the envelope is continuous. */
    public double interpolateSpeed(double position) {
        assert continuous : "interpolating speeds on a non continuous envelope is a risky business";
        var envelopePartIndex = findLeft(position);
        assert envelopePartIndex != -1;
        return get(envelopePartIndex).interpolateSpeed(position);
    }

    /**
     * Interpolates speeds, prefers EnvelopeParts coming from the left, along the given direction
     */
    public double interpolateSpeedLeftDir(double position, double direction) {
        var partIndex = findLeftDir(position, direction);
        return get(partIndex).interpolateSpeed(position);
    }

    /**
     * Interpolates speeds, prefers EnvelopeParts coming from the right, along the given direction
     */
    public double interpolateSpeedRightDir(double position, double direction) {
        var partIndex = findRightDir(position, direction);
        return get(partIndex).interpolateSpeed(position);
    }

    /**
     * Return the maximum speed in the range [beginPos, endPos]. Assumes the envelope is continuous.
     */
    public double maxSpeedInRange(double beginPos, double endPos) {
        var beginPartIndex = findLeft(beginPos);
        var endPartIndex = findRight(endPos);
        var maxSpeed = get(beginPartIndex).interpolateSpeed(beginPos);
        for (int i = beginPartIndex + 1; i < endPartIndex; i++) {
            var part = get(i);
            var partMaxSpeed = part.getMaxSpeed();
            if (partMaxSpeed > maxSpeed) maxSpeed = partMaxSpeed;
        }
        var endSpeed = get(endPartIndex).interpolateSpeed(endPos);
        if (endSpeed > maxSpeed) maxSpeed = endSpeed;

        return maxSpeed;
    }

    /** Computes the time required to get to a given point of the envelope */
    public long interpolateTotalTimeMS(double position) {
        assert continuous : "interpolating times on a non continuous envelope is a risky business";
        var envelopePartIndex = findLeft(position);
        assert envelopePartIndex >= 0 : "Trying to interpolate time outside of the envelope";
        var envelopePart = get(envelopePartIndex);
        return getCumulativeTimeMS(envelopePartIndex) + envelopePart.interpolateTotalTimeMS(position);
    }

    /** Computes the time required to get to a given point of the envelope */
    public double interpolateTotalTime(double position) {
        return ((double) interpolateTotalTimeMS(position)) / 1000;
    }

    /**
     * Computes the time required to get to a given point of the envelope. The value is clamped to
     * the [0, envelope length] range.
     */
    public double interpolateTotalTimeClamp(double position) {
        position = Math.min(getEndPos(), Math.max(0, position));
        return ((double) interpolateTotalTimeMS(position)) / 1000;
    }

    // endregion

    // region CACHING

    /** This method must be private as it returns an array */
    private long[] getCumulativeTimesMS() {
        if (cumulativeTimesCache != null) return cumulativeTimesCache;

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

    /** Returns the time between two positions of the envelope */
    public double getTimeBetween(double beginPos, double endPos) {
        return interpolateTotalTime(endPos) - interpolateTotalTime(beginPos);
    }

    /**
     * Returns the total time required to get from the start of the envelope to the start of an
     * envelope part, in milliseconds
     *
     * @param transitionIndex either an envelope part index, of the number of parts to get the total
     *     time
     */
    public long getCumulativeTimeMS(int transitionIndex) {
        return getCumulativeTimesMS()[transitionIndex];
    }

    // endregion

    // region SLICING

    /**
     * Cuts an envelope, interpolating new points if required.
     *
     * @return a list of envelope parts spanning from beginPosition to endPosition
     */
    public EnvelopePart[] slice(double beginPosition, double endPosition) {
        return slice(beginPosition, Double.NaN, endPosition, Double.NaN);
    }

    /**
     * Cuts an envelope, interpolating new points if required.
     *
     * @return a list of envelope parts spanning from beginPosition to endPosition
     */
    public EnvelopePart[] slice(double beginPosition, double beginSpeed, double endPosition, double endSpeed) {
        int beginIndex = 0;
        var beginPartIndex = 0;
        if (beginPosition != Double.NEGATIVE_INFINITY) {
            beginPartIndex = findRight(beginPosition);
            var beginPart = parts[beginPartIndex];
            beginIndex = beginPart.findRight(beginPosition);
        }
        var endPartIndex = parts.length - 1;
        var endPart = parts[endPartIndex];
        int endIndex = endPart.stepCount() - 1;
        if (endPosition != Double.POSITIVE_INFINITY) {
            endPartIndex = findLeft(endPosition);
            endPart = parts[endPartIndex];
            endIndex = endPart.findLeft(endPosition);
        }
        return slice(
                beginPartIndex, beginIndex, beginPosition, beginSpeed, endPartIndex, endIndex, endPosition, endSpeed);
    }

    /** Cuts an envelope */
    public EnvelopePart[] slice(
            int beginPartIndex,
            int beginStepIndex,
            double beginPosition,
            double beginSpeed,
            int endPartIndex,
            int endStepIndex,
            double endPosition,
            double endSpeed) {
        assert beginPartIndex <= endPartIndex;

        if (beginPartIndex == endPartIndex) {
            var part = parts[beginPartIndex];
            var sliced = part.slice(beginStepIndex, beginPosition, beginSpeed, endStepIndex, endPosition, endSpeed);
            if (sliced == null) return new EnvelopePart[] {};
            return new EnvelopePart[] {sliced};
        }

        var beginPart = parts[beginPartIndex];
        var endPart = parts[endPartIndex];
        var beginPartSliced = beginPart.sliceEnd(beginStepIndex, beginPosition, beginSpeed);
        var endPartSliced = endPart.sliceBeginning(endStepIndex, endPosition, endSpeed);

        // compute the number of unchanged envelope parts between sliced parts
        var copySize = endPartIndex - beginPartIndex + 1 - /* sliced endpoints */ 2;

        // compute the total sliced envelope size
        var size = copySize;
        if (beginPartSliced != null) size++;
        if (endPartSliced != null) size++;

        var res = new EnvelopePart[size];

        int cur = 0;
        if (beginPartSliced != null) res[cur++] = beginPartSliced;

        var copyStartIndex = beginPartIndex + 1;
        for (int i = 0; i < copySize; i++) res[cur++] = parts[copyStartIndex + i];

        if (endPartSliced != null) res[cur] = endPartSliced;
        return res;
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
                if (!hasNext()) throw new NoSuchElementException();
                return parts[i++];
            }
        };
    }

    @Override
    public List<EnvelopePoint> iteratePoints() {
        var res = new ArrayList<EnvelopePoint>();
        double time = 0;
        for (var part : this) {
            // Add head position points
            for (int i = 0; i < part.pointCount(); i++) {
                var pos = part.getPointPos(i);
                var speed = part.getPointSpeed(i);
                res.add(new EnvelopePoint(time, speed, pos));
                if (i < part.stepCount()) time += part.getStepTime(i);
            }
        }
        return res;
    }

    /** Makes a stream from the parts */
    public Stream<EnvelopePart> stream() {
        return Arrays.stream(parts);
    }
}
