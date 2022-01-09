package fr.sncf.osrd.envelope;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import javafx.scene.effect.Light;

import java.util.Arrays;

/**
 * <p>Envelope parts are polylines over speed and space, defined as a sequence of points.</p>
 * <ul>
 *  <li>single and zero point polylines are not valid</li>
 *  <li>the position of line points must be strictly increasing</li>
 *  <li>each segment of the line is thus a step over space, which is indexed from 0 to stepCount()</li>
 * </ul>
 */
public final class EnvelopePart {
    // region DATA FIELDS

    /** Metadata about his envelope part */
    public final EnvelopePartMeta meta;

    /* !!! These arrays must stay private, as even public final arrays are mutable !!! */

    /** A list of N spacial offsets */
    private final double[] positions;
    /** A list of N speeds, one per position */
    private final double[] speeds;

    /** A list of N - 1 time deltas between positions */
    private final double[] timeDeltas;

    // endregion

    // region CACHE FIELDS

    // these two fields could be public, but aren't for the sake of keeping the ability to compute these values lazily
    /** The highest speed */
    private final double maxSpeed;
    /** The smallest speed */
    private final double minSpeed;

    /** The time from the start of the envelope, in milliseconds. Only read using getTotalTimes. */
    private long[] totalTimesCache = null;

    // endregion

    // region CONSTRUCTORS

    /** Creates an EnvelopePart */
    @SuppressFBWarnings({"EI_EXPOSE_REP2"})
    public EnvelopePart(
            EnvelopePartMeta meta,
            double[] positions,
            double[] speeds,
            double[] timeDeltas
    ) {
        assert positions.length == speeds.length;
        assert positions.length >= 2;
        assert timeDeltas.length == positions.length - 1;
        assert checkNaNFree(positions) && checkMonotonousIncreasing(positions);
        assert checkNaNFree(speeds) && checkPositive(speeds);
        assert checkNaNFree(timeDeltas) && checkPositive(timeDeltas) && checkNonZero(timeDeltas);
        this.meta = meta;

        this.positions = positions;
        this.speeds = speeds;
        this.timeDeltas = timeDeltas;

        var maxSpeed = Double.NEGATIVE_INFINITY;
        for (var speed : speeds)
            if (speed > maxSpeed)
                maxSpeed = speed;
        this.maxSpeed = maxSpeed;

        var minSpeed = Double.POSITIVE_INFINITY;
        for (var speed : speeds)
            if (speed < minSpeed)
                minSpeed = speed;
        this.minSpeed = minSpeed;
    }

    /** Creates an envelope part by generating step times from speeds and positions */
    public static EnvelopePart generateTimes(
            EnvelopePartMeta meta,
            double[] positions,
            double[] speeds
    ) {
        return new EnvelopePart(
                meta,
                positions,
                speeds,
                computeTimes(positions, speeds)
        );
    }

    // endregion

    // region SANITY_CHECKS

    private static boolean checkNaNFree(double[] values) {
        for (var val : values)
            if (Double.isNaN(val))
                return false;
        return true;
    }

    private static boolean checkPositive(double[] values) {
        for (var val : values)
            if (val < 0)
                return false;
        return true;
    }

    private static boolean checkNonZero(double[] values) {
        for (var val : values)
            if (val == 0.0)
                return false;
        return true;
    }

    private static boolean checkMonotonousIncreasing(double[] values) {
        for (int i = 0; i < values.length - 1; i++)
            if (values[i] >= values[i + 1])
                return false;
        return true;
    }

    private boolean checkPosition(int stepIndex, double position) {
        return position >= getBeginPos(stepIndex) && position <= getEndPos(stepIndex);
    }

    // endregion

    // region GETTERS

    /** The number of points in the envelope part */
    public int pointCount() {
        return positions.length;
    }

    /** The number of steps in the envelope part */
    public int stepCount() {
        return positions.length - 1;
    }

    /** Returns the maximum speed of the envelope part */
    public double getMaxSpeed() {
        return maxSpeed;
    }

    /** Returns the minimum speed of the envelope part */
    public double getMinSpeed() {
        return minSpeed;
    }

    public double getBeginPos(int stepIndex) {
        return positions[stepIndex];
    }

    public double getBeginPos() {
        return getBeginPos(0);
    }

    public double getEndPos(int stepIndex) {
        return positions[stepIndex + 1];
    }

    public double getEndPos() {
        return getEndPos(stepCount() - 1);
    }

    public double getBeginSpeed(int stepIndex) {
        return speeds[stepIndex];
    }

    public double getBeginSpeed() {
        return getBeginSpeed(0);
    }

    public double getEndSpeed(int stepIndex) {
        return speeds[stepIndex + 1];
    }

    public double getEndSpeed() {
        return getEndSpeed(stepCount() - 1);
    }

    public double getPointPos(int pointIndex) {
        return positions[pointIndex];
    }

    public double getPointSpeed(int pointIndex) {
        return speeds[pointIndex];
    }

    // endregion

    // region CACHING

    /** This method must be private as it returns an array */
    private long[] getTotalTimes() {
        if (totalTimesCache != null)
            return totalTimesCache;

        var totalTimes = new long[positions.length];
        totalTimes[0] = 0;

        long totalTime = 0;
        for (int i = 0; i < timeDeltas.length; i++) {
            totalTime += (long) (timeDeltas[i] * 1000);
            totalTimes[i + 1] = totalTime;
        }
        totalTimesCache = totalTimes;
        return totalTimes;
    }

    /** Returns the total time of the envelope part, in milliseconds */
    public long getTotalTime() {
        var totalTimes = getTotalTimes();
        return totalTimes[totalTimes.length - 1];
    }


    /** Returns the total time required to get from the start of the envelope to a given
     * point of the envelope part, in milliseconds
     */
    public long getTotalTime(int pointIndex) {
        return getTotalTimes()[pointIndex];
    }

    // endregion

    // region CLONE

    public double[] clonePositions() {
        return positions.clone();
    }

    public double[] cloneSpeeds() {
        return speeds.clone();
    }

    public double[] cloneTimes() {
        return timeDeltas.clone();
    }

    // endregion

    // region SCAN

    /** Scan the envelope from startIndex to find the first step which contains pos */
    public int findStep(int startIndex, double pos) {
        assert pos >= getBeginPos();
        assert pos <= getEndPos();
        for (int i = startIndex; i < positions.length - 1; i++) {
            var stepBegin = positions[i];
            var stepEnd = positions[i + 1];
            if (pos >= stepBegin && pos <= stepEnd)
                return i;
        }
        return -1;
    }

    public int findStep(double pos) {
        return findStep(0, pos);
    }

    // endregion

    // region INTERPOLATION

    /** Given a position return the interpolated speed. */
    public double interpolateSpeed(double position) {
        var stepIndex = findStep(position);
        return interpolateSpeed(stepIndex, position);
    }

    /** Given a position return the interpolated speed. */
    public double interpolateSpeed(int stepIndex, double position) {
        assert checkPosition(stepIndex, position);
        if (position == positions[stepIndex])
            return speeds[stepIndex];
        if (position == positions[stepIndex + 1])
            return speeds[stepIndex + 1];
        return EnvelopePhysics.interpolateStepSpeed(
                positions[stepIndex], positions[stepIndex + 1],
                speeds[stepIndex], speeds[stepIndex + 1],
                position - positions[stepIndex]
        );
    }

    /** Given a position return the interpolated deltaTime */
    public double interpolateTimeDelta(int stepIndex, double position) {
        assert checkPosition(stepIndex, position);
        if (position == positions[stepIndex])
            return 0.0;
        if (position == positions[stepIndex + 1])
            return timeDeltas[stepIndex];
        return EnvelopePhysics.interpolateStepTime(
                positions[stepIndex], positions[stepIndex + 1],
                speeds[stepIndex], speeds[stepIndex + 1],
                position - positions[stepIndex]
        );
    }

    /** Finds the time required to get from the start of the envelope to the given position, in milliseconds */
    public long interpolateTotalTime(int stepIndex, double position) {
        long timeToStepStart = getTotalTime(stepIndex);
        var interpolatedTime = interpolateTimeDelta(stepIndex, position);
        return timeToStepStart + (long) (interpolatedTime * 1000);
    }

    /** Compute the time deltas between positions */
    private static double[] computeTimes(double[] positions, double[] speeds) {
        var timeDeltas = new double[positions.length - 1];
        for (int i = 0; i < positions.length - 1; i++) {
            var posDelta = positions[i + 1] - positions[i];
            timeDeltas[i] = EnvelopePhysics.interpolateStepTime(
                    positions[i], positions[i + 1],
                    speeds[i], speeds[i + 1],
                    posDelta
            );
        }
        return timeDeltas;
    }

    // endregion

    // region SLICING

    /** Makes a copy of this EnvelopePart from beginStepIndex (included) to endStepIndex (excluded) */
    public EnvelopePart sliceIndex(int beginStepIndex, int endStepIndex) {
        assert endStepIndex >= 0 && endStepIndex <= stepCount();
        assert beginStepIndex >= 0 && beginStepIndex <= stepCount();
        assert beginStepIndex <= endStepIndex;

        var resultSize = endStepIndex - beginStepIndex;
        if (resultSize <= 0)
            return null;

        var slicePos = Arrays.copyOfRange(positions, beginStepIndex, endStepIndex + 1);
        var sliceSpeeds = Arrays.copyOfRange(speeds, beginStepIndex, endStepIndex + 1);
        var sliceTimes = Arrays.copyOfRange(timeDeltas, beginStepIndex, endStepIndex);
        return new EnvelopePart(
                meta,
                slicePos,
                sliceSpeeds,
                sliceTimes
        );
    }

    public EnvelopePart sliceBeginning(int endIndex, double endPosition) {
        return slice(0, Double.NEGATIVE_INFINITY, endIndex, endPosition);
    }

    public EnvelopePart sliceEnd(int beginIndex, double beginPosition) {
        return slice(beginIndex, beginPosition, stepCount() - 1, Double.POSITIVE_INFINITY);
    }

    /** Cuts an envelope part, interpolating new points if required.
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    public EnvelopePart slice(double beginPosition, double endPosition) {
        int beginIndex = 0;
        if (beginPosition != Double.NEGATIVE_INFINITY)
            beginIndex = findStep(beginPosition);
        int endIndex = stepCount() - 1;
        if (endPosition != Double.POSITIVE_INFINITY)
            endIndex = findStep(endPosition);
        return slice(beginIndex, beginPosition, endIndex, endPosition);
    }

    /** Cuts an envelope part, interpolating new points if required.
     * @param beginStepIndex the index of a step beginPosition belongs to
     * @param beginPosition must belong to the step at beginStepIndex
     * @param endStepIndex the index of a step endPosition belongs to
     * @param endPosition must belong to the step at beginStepIndex
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    public EnvelopePart slice(
            int beginStepIndex, double beginPosition,
            int endStepIndex, double endPosition
    ) {
        assert endStepIndex >= 0 && endStepIndex < stepCount();
        assert beginStepIndex >= 0 && beginStepIndex < stepCount();

        // remove empty ranges from the slice and avoid needless interpolations
        if (endPosition == getBeginPos(endStepIndex)) {
            endPosition = Double.POSITIVE_INFINITY;
            endStepIndex -= 1;
        } else if (endPosition == getEndPos(endStepIndex))
            endPosition = Double.POSITIVE_INFINITY;
        if (beginPosition == getEndPos(beginStepIndex)) {
            beginPosition = Double.NEGATIVE_INFINITY;
            beginStepIndex += 1;
        } else if (beginPosition == getBeginPos(beginStepIndex))
            beginPosition = Double.NEGATIVE_INFINITY;

        // if the slice spans all the envelope part, don't make a copy
        if (beginStepIndex == 0 && endStepIndex == stepCount() - 1
                && beginPosition == Double.NEGATIVE_INFINITY
                && endPosition == Double.POSITIVE_INFINITY)
            return this;

        // copy affected steps
        var sliced = sliceIndex(beginStepIndex, endStepIndex + 1);
        if (sliced == null)
            return null;

        // interpolate if necessary
        if (endPosition != Double.POSITIVE_INFINITY) {
            double interpolatedSpeed = interpolateSpeed(endStepIndex, endPosition);
            double interpolatedTime = interpolateTimeDelta(endStepIndex, endPosition);
            sliced.positions[sliced.pointCount() - 1] = endPosition;
            sliced.speeds[sliced.pointCount() - 1] = interpolatedSpeed;
            sliced.timeDeltas[sliced.stepCount() - 1] = interpolatedTime;
        }
        if (beginPosition != Double.NEGATIVE_INFINITY) {
            double interpolatedSpeed = interpolateSpeed(beginStepIndex, beginPosition);
            double interpolatedTime = interpolateTimeDelta(beginStepIndex, beginPosition);
            sliced.positions[0] = beginPosition;
            sliced.speeds[0] = interpolatedSpeed;
            sliced.timeDeltas[0] = interpolatedTime;
        }
        return sliced;
    }

    public EnvelopePart slice(EnvelopePartPosition begin, EnvelopePartPosition end) {
        return slice(begin.getStepIndex(), begin.getPosition(), end.getStepIndex(), end.getPosition());
    }

    /**
     * Works just like slice, but interprets -1 as the lack of bound
     * @see #slice(int, double, int, double)
     */
    EnvelopePart smartSlice(
            int beginStepIndex, double beginPosition,
            int endStepIndex, double endPosition
    ) {
        if (beginStepIndex != -1 && endStepIndex != -1)
            return slice(beginStepIndex, beginPosition, endStepIndex, endPosition);
        if (beginStepIndex != -1)
            return sliceEnd(beginStepIndex, beginPosition);
        if (endStepIndex != -1)
            return sliceBeginning(endStepIndex, endPosition);
        return this;
    }

    // endregion

    // region EQUALS

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        EnvelopePart that = (EnvelopePart) o;
        return (meta == that.meta
                && Arrays.equals(positions, that.positions)
                && Arrays.equals(speeds, that.speeds)
                && Arrays.equals(timeDeltas, that.timeDeltas));
    }

    @Override
    public int hashCode() {
        int result = System.identityHashCode(meta);
        result = 31 * result + Arrays.hashCode(positions);
        result = 31 * result + Arrays.hashCode(speeds);
        result = 31 * result + Arrays.hashCode(timeDeltas);
        return result;
    }

    // endregion
}
