package fr.sncf.osrd.envelope;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
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
    /** Metadata about his envelope part */
    public final EnvelopePartMeta meta;

    /** A list of N spacial offsets */
    public final double[] positions;
    /** A list of N speeds, one per position */
    public final double[] speeds;

    /** A list of N - 1 time deltas between positions */
    public final double[] times;

    /** Creates an EnvelopePart */
    @SuppressFBWarnings({"EI_EXPOSE_REP2"})
    public EnvelopePart(
            EnvelopePartMeta meta,
            double[] positions,
            double[] speeds,
            double[] times
    ) {
        assert positions.length == speeds.length;
        assert positions.length >= 2;
        assert times.length == positions.length - 1;
        assert checkNaNFree(positions) && checkMonotonousIncreasing(positions);
        assert checkNaNFree(speeds) && checkPositive(speeds);
        assert checkNaNFree(times) && checkPositive(times) && checkNonZero(times);
        this.meta = meta;

        this.positions = positions;
        this.speeds = speeds;
        this.times = times;
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
    public double interpolateTime(int stepIndex, double position) {
        assert checkPosition(stepIndex, position);
        if (position == positions[stepIndex])
            return 0.0;
        if (position == positions[stepIndex + 1])
            return times[stepIndex];
        return EnvelopePhysics.interpolateStepTime(
                positions[stepIndex], positions[stepIndex + 1],
                speeds[stepIndex], speeds[stepIndex + 1],
                position - positions[stepIndex]
        );
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
        var sliceTimes = Arrays.copyOfRange(times, beginStepIndex, endStepIndex);
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
            double interpolatedTime = interpolateTime(endStepIndex, endPosition);
            sliced.positions[sliced.pointCount() - 1] = endPosition;
            sliced.speeds[sliced.pointCount() - 1] = interpolatedSpeed;
            sliced.times[sliced.stepCount() - 1] = interpolatedTime;
        }
        if (beginPosition != Double.NEGATIVE_INFINITY) {
            double interpolatedSpeed = interpolateSpeed(beginStepIndex, beginPosition);
            double interpolatedTime = interpolateTime(beginStepIndex, beginPosition);
            sliced.positions[0] = beginPosition;
            sliced.speeds[0] = interpolatedSpeed;
            sliced.times[0] = interpolatedTime;
        }
        return sliced;
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
                && Arrays.equals(times, that.times));
    }

    @Override
    public int hashCode() {
        int result = System.identityHashCode(meta);
        result = 31 * result + Arrays.hashCode(positions);
        result = 31 * result + Arrays.hashCode(speeds);
        result = 31 * result + Arrays.hashCode(times);
        return result;
    }

    // endregion
}
