package fr.sncf.osrd.envelope.part;

import static fr.sncf.osrd.envelope.EnvelopePhysics.intersectStepWithSpeed;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.EnvelopeAttr;
import fr.sncf.osrd.envelope.EnvelopePhysics;
import fr.sncf.osrd.envelope.SearchableEnvelope;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.*;
import java.util.stream.Collectors;

/**
 * <p>Envelope parts are polylines over speed and space, defined as a sequence of points.</p>
 * <ul>
 *  <li>single and zero point polylines are not valid</li>
 *  <li>the position of line points must be strictly increasing</li>
 *  <li>each segment of the line is thus a step over space, which is indexed from 0 to stepCount()</li>
 * </ul>
 */
public final class EnvelopePart implements SearchableEnvelope {
    // region INTRINSIC DATA FIELDS

    /** Metadata about this envelope part */
    private final Map<Class<? extends EnvelopeAttr>, EnvelopeAttr> attrs;

    /* !!! These arrays must stay private, as even public final arrays are mutable !!! */

    /** A list of N spacial offsets */
    private final double[] positions;
    /** A list of N speeds, one per position */
    private final double[] speeds;

    /** A list of N - 1 time deltas between positions */
    private final double[] timeDeltas;

    // endregion

    // region CACHE FIELDS

    /** This property is required for inverse lookups on speeds
     * https://en.wikipedia.org/wiki/Monotonic_function#Inverse_of_function
     */
    private final boolean strictlyMonotonicSpeeds;

    /* Cache fields must not be public, and must also be lazily computed.
       This ensures intrinsic data fields can be modified while constructing
       the envelope part. */

    /** The highest speed */
    private double maxSpeedCache = Double.NaN;
    /** The smallest speed */
    private double minSpeedCache = Double.NaN;

    /** The time from the start of the envelope, in milliseconds. Only read using getTotalTimes. */
    private long[] cumulativeMSTimesCache = null;

    // endregion

    // region CONSTRUCTORS

    /** Creates an EnvelopePart */
    @SuppressFBWarnings({"EI_EXPOSE_REP2"})
    @ExcludeFromGeneratedCodeCoverage
    public EnvelopePart(
            Map<Class<? extends EnvelopeAttr>, EnvelopeAttr> attrs,
            double[] positions,
            double[] speeds,
            double[] timeDeltas
    ) {
        assert attrs != null : "missing attributes";
        assert positions.length >= 2 : "attempted to create a single point EnvelopePart";
        assert positions.length == speeds.length : "there must be the same number of point and speeds";
        assert timeDeltas.length == positions.length - 1 : "there must be as many timeDeltas as gaps between points";
        assert checkNaNFree(positions) : "NaNs in positions";
        assert checkNaNFree(speeds) : "NaNs in speeds";
        assert checkNaNFree(timeDeltas) : "NaNs in timeDeltas";
        assert checkStrictlyMonotonicIncreasing(positions) : "non monotonously increasing positions";
        assert checkPositive(speeds) : "negative speeds";
        assert checkPositive(timeDeltas) : "negative timeDeltas";
        assert checkNonZero(timeDeltas) : "zero timeDeltas";
        this.attrs = attrs;
        this.positions = positions;
        this.speeds = speeds;
        this.timeDeltas = timeDeltas;
        this.strictlyMonotonicSpeeds = checkStrictlyMonotonic(speeds);
    }

    /** Creates an EnvelopePart */
    @SuppressFBWarnings({"EI_EXPOSE_REP2"})
    @ExcludeFromGeneratedCodeCoverage
    public EnvelopePart(
            Iterable<EnvelopeAttr> attrs,
            double[] positions,
            double[] speeds,
            double[] timeDeltas
    ) {
        this(makeAttrs(attrs), positions, speeds, timeDeltas);
    }

    /** Creates an envelope part by generating step times from speeds and positions */
    public static EnvelopePart generateTimes(
            Iterable<EnvelopeAttr> attrs,
            double[] positions,
            double[] speeds
    ) {
        return new EnvelopePart(
                attrs,
                positions,
                speeds,
                computeTimes(positions, speeds)
        );
    }

    /** Creates an envelope part by generating step times from speeds and positions */
    public static EnvelopePart generateTimes(
            double[] positions,
            double[] speeds
    ) {
        return new EnvelopePart(
                new HashMap<>(),
                positions,
                speeds,
                computeTimes(positions, speeds)
        );
    }

    // endregion

    // region ATTRS

    /** Create an attribute map from the given attributes */
    public static Map<Class<? extends EnvelopeAttr>, EnvelopeAttr> makeAttrs(Iterable<EnvelopeAttr> attrs) {
        var res = new HashMap<Class<? extends EnvelopeAttr>, EnvelopeAttr>();
        for (var attr : attrs)
            res.put(attr.getAttrType(), attr);
        return res;
    }

    /** Return the given metadata attribute */
    @SuppressWarnings({"unchecked"})
    public <T extends EnvelopeAttr> T getAttr(Class<T> attrType) {
        return (T) attrs.get(attrType);
    }

    /** Returns whether this envelope part has a given attribute */
    public boolean hasAttr(Class<? extends EnvelopeAttr> attrType) {
        return attrs.containsKey(attrType);
    }

    /**
     * Returns whether the envelope has the given attribute value. Usually, we can't deduce the attribute type
     * from the attribute value, but we can for enums.
     */
    public <T extends EnvelopeAttr> boolean hasAttr(T attr) {
        return attrs.get(attr.getAttrType()) == attr;
    }

    /** Returns a view of the envelope part attributes */
    public Map<Class<? extends EnvelopeAttr>, EnvelopeAttr> getAttrs() {
        return Collections.unmodifiableMap(attrs);
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

    private static boolean checkStrictlyMonotonicIncreasing(double[] values) {
        for (int i = 0; i < values.length - 1; i++)
            if (values[i] >= values[i + 1])
                return false;
        return true;
    }

    private static boolean checkStrictlyMonotonicDecreasing(double[] values) {
        for (int i = 0; i < values.length - 1; i++)
            if (values[i] <= values[i + 1])
                return false;
        return true;
    }

    private static boolean checkStrictlyMonotonic(double[] values) {
        return checkStrictlyMonotonicIncreasing(values) || checkStrictlyMonotonicDecreasing(values);
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
        if (!Double.isNaN(maxSpeedCache))
            return maxSpeedCache;

        var maxSpeed = Double.NEGATIVE_INFINITY;
        for (var speed : speeds)
            if (speed > maxSpeed)
                maxSpeed = speed;
        this.maxSpeedCache = maxSpeed;
        return maxSpeed;
    }

    /** Returns the minimum speed of the envelope part */
    public double getMinSpeed() {
        if (!Double.isNaN(minSpeedCache))
            return minSpeedCache;

        var minSpeed = Double.POSITIVE_INFINITY;
        for (var speed : speeds)
            if (speed < minSpeed)
                minSpeed = speed;
        this.minSpeedCache = minSpeed;
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

    public double getStepTime(int stepIndex) {
        return timeDeltas[stepIndex];
    }

    // endregion

    // region CACHING

    /** This method must be private as it returns an array (thus mutable cache).
     * It computes and caches the time in milliseconds the any point of the envelope part,
     * from the start of the envelope part.
     */
    private long[] getTotalTimesMS() {
        if (cumulativeMSTimesCache != null)
            return cumulativeMSTimesCache;

        var totalTimes = new long[positions.length];
        totalTimes[0] = 0;

        long totalTime = 0;
        for (int i = 0; i < timeDeltas.length; i++) {
            totalTime += (long) (timeDeltas[i] * 1000);
            totalTimes[i + 1] = totalTime;
        }
        cumulativeMSTimesCache = totalTimes;
        return totalTimes;
    }

    /** Returns the total time of the envelope part, in milliseconds */
    public long getTotalTimeMS() {
        var totalTimes = getTotalTimesMS();
        return totalTimes[totalTimes.length - 1];
    }


    /** Returns the total time required to get from the start of the envelope part to a given
     * point of the envelope part, in milliseconds
     */
    public long getTotalTimeMS(int pointIndex) {
        return getTotalTimesMS()[pointIndex];
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

    // region FIND

    @Override
    public int binarySearchPositions(double position) {
        return Arrays.binarySearch(positions, position);
    }

    @Override
    public int positionPointsCount() {
        return positions.length;
    }

    // endregion

    // region INTERPOLATION

    /** Given a position return the interpolated speed. */
    public double interpolateSpeed(double position) {
        assert position >= getBeginPos() && position <= getEndPos();
        var pointIndex = Arrays.binarySearch(positions, position);
        // if the position matches one of the data points
        if (pointIndex >= 0)
            return speeds[pointIndex];

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        var insertionPoint = -(pointIndex + 1);
        // the index of the step is the index of the point which starts the range
        var stepIndex = insertionPoint - 1;
        return EnvelopePhysics.interpolateStepSpeed(
                positions[stepIndex], positions[stepIndex + 1],
                speeds[stepIndex], speeds[stepIndex + 1],
                position - positions[stepIndex]
        );
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

    /** Returns the time required to get from the start of the envelope part
     * to the given position, in milliseconds.
     */
    public long interpolateTotalTimeMS(double position) {
        assert position >= getBeginPos();
        assert position <= getEndPos();
        var pointIndex = Arrays.binarySearch(positions, position);
        // if the position matches one of the data points
        if (pointIndex >= 0)
            return getTotalTimeMS(pointIndex);

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        var insertionPoint = -(pointIndex + 1);
        // the index of the step is the index of the point which starts the range
        var stepIndex = insertionPoint - 1;
        long timeToStepStart = getTotalTimeMS(stepIndex);
        var interpolatedTime = interpolateTimeDelta(stepIndex, position);
        return timeToStepStart + (long) (interpolatedTime * 1000);
    }

    /** Returns the time required to get from the start of the envelope part
     * to the given position, in seconds
     */
    public double interpolateTotalTime(double position) {
        return ((double) interpolateTotalTimeMS(position)) / 1000;
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

    /** Given a speed return a position. The envelopePart must be bijective in order for this method to work*/
    public Double interpolatePosition(int startIndex, double speed) {
        assert strictlyMonotonicSpeeds;
        assert isBetween(speed, getMinSpeed(), getMaxSpeed());

        for (int i = startIndex; i < positions.length - 1; i++) {
            var stepBegin = positions[i];
            var stepEnd = positions[i + 1];
            var speedBegin = speeds[i];
            var speedEnd = speeds[i + 1];
            assert speedBegin != speedEnd;
            if (isBetween(speed, speedBegin, speedEnd))
                return intersectStepWithSpeed(stepBegin, speedBegin, stepEnd, speedEnd, speed);
        }
        return null;
    }

    /** Given a speed return a position. The envelopePart must be bijective in order for this method to work*/
    public Double interpolatePosition(double speed) {
        return interpolatePosition(0, speed);
    }


    /** Check if a is in the interval [b, c] or [c, b]*/
    private static boolean isBetween(double a, double b, double c) {
        var min = Math.min(b, c);
        var max = Math.max(b, c);
        return min <= a && a <= max;
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
                attrs,
                slicePos,
                sliceSpeeds,
                sliceTimes
        );
    }

    public EnvelopePart sliceBeginning(int endIndex, double endPosition, double endSpeed) {
        return slice(0, Double.NEGATIVE_INFINITY, Double.NaN, endIndex, endPosition, endSpeed);
    }

    public EnvelopePart sliceEnd(int beginIndex, double beginPosition, double beginSpeed) {
        return slice(beginIndex, beginPosition, beginSpeed, stepCount() - 1, Double.POSITIVE_INFINITY, Double.NaN);
    }

    /** Cuts an envelope part with imposed speeds on the edges
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    public EnvelopePart sliceWithSpeeds(
            double beginPosition, double beginSpeed,
            double endPosition, double endSpeed) {
        int beginIndex = 0;
        if (beginPosition <= getBeginPos())
            beginPosition = Double.NEGATIVE_INFINITY;
        if (beginPosition != Double.NEGATIVE_INFINITY)
            beginIndex = findRight(beginPosition);
        int endIndex = stepCount() - 1;
        if (endPosition >= getEndPos())
            endPosition = Double.POSITIVE_INFINITY;
        if (endPosition != Double.POSITIVE_INFINITY)
            endIndex = findLeft(endPosition);
        return slice(beginIndex, beginPosition, beginSpeed, endIndex, endPosition, endSpeed);
    }

    /** Cuts an envelope part, interpolating new points if required.
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    public EnvelopePart slice(double beginPosition, double endPosition) {
        int beginIndex = 0;
        if (beginPosition <= getBeginPos())
            beginPosition = Double.NEGATIVE_INFINITY;
        if (beginPosition != Double.NEGATIVE_INFINITY)
            beginIndex = findRight(beginPosition);
        int endIndex = stepCount() - 1;
        if (endPosition >= getEndPos())
            endPosition = Double.POSITIVE_INFINITY;
        if (endPosition != Double.POSITIVE_INFINITY)
            endIndex = findLeft(endPosition);
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
        return slice(beginStepIndex, beginPosition, Double.NaN, endStepIndex, endPosition, Double.NaN);
    }

    /** Cuts an envelope part, interpolating new points if required.
     * @param beginStepIndex the index of a step beginPosition belongs to
     * @param beginPosition must belong to the step at beginStepIndex
     * @param beginSpeed the forced start speed of the envelope slice
     * @param endStepIndex the index of a step endPosition belongs to
     * @param endPosition must belong to the step at beginStepIndex
     * @param endSpeed the forced end speed of the envelope slice
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    public EnvelopePart slice(
            int beginStepIndex, double beginPosition, double beginSpeed,
            int endStepIndex, double endPosition, double endSpeed
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
                && endPosition == Double.POSITIVE_INFINITY
                && Double.isNaN(beginSpeed)
                && Double.isNaN(endSpeed))
            return this;

        // copy affected steps
        var sliced = sliceIndex(beginStepIndex, endStepIndex + 1);
        if (sliced == null)
            return null;

        // interpolate if necessary
        if (endPosition != Double.POSITIVE_INFINITY) {
            if (Double.isNaN(endSpeed))
                endSpeed = interpolateSpeed(endStepIndex, endPosition);
            double interpolatedTimeDelta = interpolateTimeDelta(endStepIndex, endPosition);
            sliced.positions[sliced.pointCount() - 1] = endPosition;
            sliced.timeDeltas[sliced.stepCount() - 1] = interpolatedTimeDelta;
        }
        if (beginPosition != Double.NEGATIVE_INFINITY) {
            if (Double.isNaN(beginSpeed))
                beginSpeed = interpolateSpeed(beginStepIndex, beginPosition);
            double interpolatedTimeDelta = interpolateTimeDelta(beginStepIndex, beginPosition);
            sliced.positions[0] = beginPosition;
            sliced.timeDeltas[0] -= interpolatedTimeDelta; // notice the -= here
        }
        if (!Double.isNaN(beginSpeed))
            sliced.speeds[0] = beginSpeed;
        if (!Double.isNaN(endSpeed))
            sliced.speeds[sliced.pointCount() - 1] = endSpeed;
        return sliced;
    }

    // endregion

    // region EQUALS

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        EnvelopePart that = (EnvelopePart) o;
        return (attrs.equals(that.attrs)
                && Arrays.equals(positions, that.positions)
                && Arrays.equals(speeds, that.speeds)
                && Arrays.equals(timeDeltas, that.timeDeltas));
    }

    @Override
    public int hashCode() {
        int result = attrs.hashCode();
        result = 31 * result + Arrays.hashCode(positions);
        result = 31 * result + Arrays.hashCode(speeds);
        result = 31 * result + Arrays.hashCode(timeDeltas);
        return result;
    }

    @Override
    public String toString() {
        var attrsRepr = attrs.entrySet().stream()
                .map((item) -> String.format("%s=%s", item.getKey().getSimpleName(), item.getValue()))
                .collect(Collectors.joining(", "));
        return String.format("EnvelopePart { %s }", attrsRepr);
    }

    // endregion
}
