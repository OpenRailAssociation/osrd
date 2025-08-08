package fr.sncf.osrd.envelope.part

import com.carrotsearch.hppc.DoubleArrayList
import fr.sncf.osrd.envelope.EnvelopePhysics
import fr.sncf.osrd.envelope.SearchableEnvelope
import fr.sncf.osrd.envelope.part.EnvelopePart.Companion.generateTimes
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_utils.ExcludeFromGeneratedCodeCoverage
import fr.sncf.osrd.utils.SelfTypeHolder
import fr.sncf.osrd.utils.arePositionsEqual
import java.lang.Double.isNaN
import java.util.*
import java.util.stream.Collectors
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Envelope parts are polylines over speed and space, defined as a sequence of points.
 * * single and zero point polylines are not valid
 * * the position of line points must be strictly increasing
 * * each segment of the line is thus a step over space, which is indexed from 0 to stepCount()
 */
class EnvelopePart(
    /**
     * Metadata about this envelope part Attributes are stored and looked up by attribute type. An
     * envelope part thus cannot have two attributes of the same type
     */
    private val attrs: Map<Class<out SelfTypeHolder>, SelfTypeHolder>,
    /** A list of N spacial offsets. Must stay private. */
    private val positions: DoubleArray,
    /** A list of N speeds, one per position. Must stay private. */
    private val speeds: DoubleArray,
    /** A list of N - 1 time deltas between positions. Must stay private. */
    private val timeDeltas: DoubleArray,
) : SearchableEnvelope {

    /**
     * This property is required for inverse lookups on speeds
     * https://en.wikipedia.org/wiki/Monotonic_function#Inverse_of_function
     */
    private val strictlyMonotonicSpeeds: Boolean = checkStrictlyMonotonic(speeds)

    /* Cache fields must not be public, and must also be lazily computed.
    This ensures intrinsic data fields can be modified while constructing
    the envelope part. */
    /** The highest speed */
    private var maxSpeedCache = Double.NaN

    /** The smallest speed */
    private var minSpeedCache = Double.NaN

    /** The time from the start of the envelope, in microseconds. Only read using getTotalTimes. */
    private var cumulativeUSTimesCache: LongArray? = null

    /** Creates an EnvelopePart */
    init {
        runSanityChecks()
    }

    /** Creates an EnvelopePart */
    @ExcludeFromGeneratedCodeCoverage
    constructor(
        attrs: Iterable<SelfTypeHolder>,
        positions: DoubleArray,
        speeds: DoubleArray,
        timeDeltas: DoubleArray,
    ) : this(makeAttrs(attrs), positions, speeds, timeDeltas)

    /** Return the given metadata attribute */
    @Suppress("UNCHECKED_CAST")
    fun <T : SelfTypeHolder?> getAttr(attrType: Class<T>): T? {
        return attrs[attrType] as T?
    }

    /** Returns whether this envelope part has a given attribute */
    fun hasAttr(attrType: Class<out SelfTypeHolder>): Boolean {
        return attrs.containsKey(attrType)
    }

    /**
     * Returns whether the envelope has the given attribute value. Usually, we can't deduce the
     * attribute type from the attribute value, but we can for enums.
     */
    fun <T : SelfTypeHolder?> hasAttr(attr: T): Boolean {
        return attrs[attr!!.selfType] === attr
    }

    /** Returns a view of the envelope part attributes */
    fun getAttrs(): Map<Class<out SelfTypeHolder>, SelfTypeHolder> {
        return Collections.unmodifiableMap(attrs)
    }

    /**
     * Runs every assertion on the envelope part values. <br></br> To be called in the constructor
     * and after the values have been edited (which should be avoided when possible)
     */
    private fun runSanityChecks() {
        assert(hasAttr(EnvelopeProfile::class.java)) { "missing EnvelopeProfile attribute" }
        assert(positions.isNotEmpty()) { "attempted to create an empty EnvelopePart" }
        assert(positions.size == speeds.size) {
            "there must be the same number of point and speeds"
        }
        assert(timeDeltas.size == positions.size - 1) {
            "there must be as many timeDeltas as gaps between points"
        }
        assert(checkNaNFree(positions)) { "NaNs in positions" }
        assert(checkNaNFree(speeds)) { "NaNs in speeds" }
        assert(checkNaNFree(timeDeltas)) { "NaNs in timeDeltas" }
        assert(checkPositive(speeds)) { "negative speeds" }
        assert(checkPositive(timeDeltas)) { "negative timeDeltas" }
        assert(checkStrictlyMonotonicIncreasing(positions)) {
            "positions aren't strictly increasing"
        }
    }

    private fun checkPosition(stepIndex: Int, position: Double): Boolean {
        return position >= getBeginPos(stepIndex) && position <= getEndPos(stepIndex)
    }

    /** The number of points in the envelope part */
    fun pointCount(): Int {
        return positions.size
    }

    /** The number of steps in the envelope part */
    fun stepCount(): Int {
        return positions.size - 1
    }

    val maxSpeed: Double
        /** Returns the maximum speed of the envelope part */
        get() {
            if (!isNaN(maxSpeedCache)) return maxSpeedCache

            val maxSpeed = speeds.maxOrNull() ?: Double.NEGATIVE_INFINITY
            this.maxSpeedCache = maxSpeed
            return maxSpeed
        }

    val minSpeed: Double
        /** Returns the minimum speed of the envelope part */
        get() {
            if (!isNaN(minSpeedCache)) return minSpeedCache

            val minSpeed = speeds.minOrNull() ?: Double.POSITIVE_INFINITY
            this.minSpeedCache = minSpeed
            return minSpeed
        }

    fun getBeginPos(stepIndex: Int): Double {
        return positions[stepIndex]
    }

    val beginPos: Double
        get() = getBeginPos(0)

    fun getEndPos(stepIndex: Int): Double {
        return positions[stepIndex + 1]
    }

    val endPos: Double
        get() = getEndPos(stepCount() - 1)

    val totalDistance: Double
        get() = abs(this.endPos - this.beginPos)

    fun getBeginSpeed(stepIndex: Int): Double {
        return speeds[stepIndex]
    }

    val beginSpeed: Double
        get() = getBeginSpeed(0)

    fun getEndSpeed(stepIndex: Int): Double {
        return speeds[stepIndex + 1]
    }

    val endSpeed: Double
        get() = getEndSpeed(stepCount() - 1)

    fun getPointPos(pointIndex: Int): Double {
        return positions[pointIndex]
    }

    fun getPointSpeed(pointIndex: Int): Double {
        return speeds[pointIndex]
    }

    fun getStepTime(stepIndex: Int): Double {
        return timeDeltas[stepIndex]
    }

    fun getPositions(): List<Double> {
        return positions.asList()
    }

    fun getSpeeds(): List<Double> {
        return speeds.asList()
    }

    fun getTimeDeltas(): List<Double> {
        return timeDeltas.asList()
    }

    private val totalTimesUS: LongArray
        /**
         * This method must be private as it returns an array (thus mutable cache). It computes and
         * caches the time in microseconds to reach any point of the envelope part, from the start
         * of the envelope part.
         */
        get() {
            if (cumulativeUSTimesCache != null) return cumulativeUSTimesCache as LongArray

            val totalTimes = LongArray(positions.size)
            totalTimes[0] = 0

            var totalTime: Long = 0
            for (i in timeDeltas.indices) {
                totalTime += (timeDeltas[i] * 1000000).toLong()
                totalTimes[i + 1] = totalTime
            }
            cumulativeUSTimesCache = totalTimes
            return totalTimes
        }

    val totalTimeUS: Long
        /** Returns the total time of the envelope part, in microseconds */
        get() = totalTimesUS.last()

    /**
     * Returns the total time required to get from the start of the envelope part to a given point
     * of the envelope part, in microseconds
     */
    fun getTotalTimeUS(pointIndex: Int): Long {
        return totalTimesUS[pointIndex]
    }

    override fun binarySearchPositions(position: Double): Int {
        return Arrays.binarySearch(positions, position)
    }

    override fun positionPointsCount(): Int {
        return positions.size
    }

    /** Given a position return the interpolated speed. */
    fun interpolateSpeed(position: Double): Double {
        assert(position in beginPos..endPos)
        val pointIndex = Arrays.binarySearch(positions, position)
        // if the position matches one of the data points
        if (pointIndex >= 0) return speeds[pointIndex]

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        val insertionPoint = -(pointIndex + 1)
        // the index of the step is the index of the point which starts the range
        val stepIndex = insertionPoint - 1
        return EnvelopePhysics.interpolateStepSpeed(
            positions[stepIndex],
            positions[stepIndex + 1],
            speeds[stepIndex],
            speeds[stepIndex + 1],
            position - positions[stepIndex],
        )
    }

    /** Given a position return the interpolated speed. */
    fun interpolateSpeed(stepIndex: Int, position: Double): Double {
        assert(checkPosition(stepIndex, position))
        if (position == positions[stepIndex]) return speeds[stepIndex]
        if (position == positions[stepIndex + 1]) return speeds[stepIndex + 1]
        return EnvelopePhysics.interpolateStepSpeed(
            positions[stepIndex],
            positions[stepIndex + 1],
            speeds[stepIndex],
            speeds[stepIndex + 1],
            position - positions[stepIndex],
        )
    }

    /** Given a position return the interpolated deltaTime */
    private fun interpolateTimeDelta(stepIndex: Int, position: Double): Double {
        assert(checkPosition(stepIndex, position))
        if (position == positions[stepIndex]) return 0.0
        if (position == positions[stepIndex + 1]) return timeDeltas[stepIndex]
        return EnvelopePhysics.interpolateStepTime(
            positions[stepIndex],
            positions[stepIndex + 1],
            speeds[stepIndex],
            speeds[stepIndex + 1],
            position - positions[stepIndex],
        )
    }

    /**
     * Returns the time required to get from the start of the envelope part to the given position,
     * in microseconds.
     */
    fun interpolateTotalTimeUS(position: Double): Long {
        assert(position >= beginPos)
        assert(position <= endPos)
        val pointIndex = Arrays.binarySearch(positions, position)
        // if the position matches one of the data points
        if (pointIndex >= 0) return getTotalTimeUS(pointIndex)

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        val insertionPoint = -(pointIndex + 1)
        // the index of the step is the index of the point which starts the range
        val stepIndex = insertionPoint - 1
        val timeToStepStart = getTotalTimeUS(stepIndex)
        val interpolatedTime = interpolateTimeDelta(stepIndex, position)
        return timeToStepStart + (interpolatedTime * 1000000).toLong()
    }

    /**
     * Returns the time required to get from the start of the envelope part to the given position,
     * in seconds
     */
    fun interpolateTotalTime(position: Double): Double {
        return (interpolateTotalTimeUS(position).toDouble()) / 1000000
    }

    /**
     * Given a speed return a position. The envelopePart must be bijective in order for this method
     * to work
     */
    fun interpolatePosition(speed: Double): Double {
        assert(strictlyMonotonicSpeeds)
        assert(isBetween(speed, minSpeed, maxSpeed))

        for (i in 0 until positions.size - 1) {
            val stepBegin = positions[i]
            val stepEnd = positions[i + 1]
            val speedBegin = speeds[i]
            val speedEnd = speeds[i + 1]
            assert(speedBegin != speedEnd)
            if (isBetween(speed, speedBegin, speedEnd))
                return EnvelopePhysics.intersectStepWithSpeed(
                    stepBegin,
                    speedBegin,
                    stepEnd,
                    speedEnd,
                    speed,
                )
        }
        throw IllegalStateException("This should be unreachable.")
    }

    /**
     * Makes a copy of this EnvelopePart from beginStepIndex (included) to endStepIndex (excluded)
     */
    fun sliceIndex(beginStepIndex: Int, endStepIndex: Int): EnvelopePart? {
        assert(endStepIndex >= 0 && endStepIndex <= stepCount())
        assert(beginStepIndex >= 0 && beginStepIndex <= stepCount())
        assert(beginStepIndex <= endStepIndex)

        val resultSize = endStepIndex - beginStepIndex
        if (resultSize <= 0) return null

        val slicePos = Arrays.copyOfRange(positions, beginStepIndex, endStepIndex + 1)
        val sliceSpeeds = Arrays.copyOfRange(speeds, beginStepIndex, endStepIndex + 1)
        val sliceTimes = Arrays.copyOfRange(timeDeltas, beginStepIndex, endStepIndex)
        return EnvelopePart(attrs, slicePos, sliceSpeeds, sliceTimes)
    }

    fun sliceBeginning(endIndex: Int, endPosition: Double, endSpeed: Double): EnvelopePart? {
        return slice(0, Double.NEGATIVE_INFINITY, Double.NaN, endIndex, endPosition, endSpeed)
    }

    fun sliceEnd(beginIndex: Int, beginPosition: Double, beginSpeed: Double): EnvelopePart? {
        return slice(
            beginIndex,
            beginPosition,
            beginSpeed,
            stepCount() - 1,
            Double.POSITIVE_INFINITY,
            Double.NaN,
        )
    }

    /**
     * Cuts an envelope part with imposed speeds on the edges
     *
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    fun sliceWithSpeeds(
        beginPosition: Double,
        beginSpeed: Double,
        endPosition: Double,
        endSpeed: Double,
    ): EnvelopePart? {
        var newBeginPos = beginPosition
        var newEndPos = endPosition
        var beginIndex = 0
        if (newBeginPos <= beginPos) newBeginPos = Double.NEGATIVE_INFINITY
        if (newBeginPos != Double.NEGATIVE_INFINITY) beginIndex = findRight(newBeginPos)
        var endIndex = stepCount() - 1
        if (newEndPos >= endPos) newEndPos = Double.POSITIVE_INFINITY
        if (newEndPos != Double.POSITIVE_INFINITY) endIndex = findLeft(newEndPos)
        return slice(beginIndex, newBeginPos, beginSpeed, endIndex, newEndPos, endSpeed)
    }

    /**
     * Cuts an envelope part, interpolating new points if required.
     *
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    fun slice(beginPosition: Double, endPosition: Double): EnvelopePart? {
        var newBeginPos = beginPosition
        var newEndPos = endPosition
        var beginIndex = 0
        if (newBeginPos <= beginPos) newBeginPos = Double.NEGATIVE_INFINITY
        if (newBeginPos != Double.NEGATIVE_INFINITY) beginIndex = findRight(newBeginPos)
        var endIndex = stepCount() - 1
        if (newEndPos >= endPos) newEndPos = Double.POSITIVE_INFINITY
        if (newEndPos != Double.POSITIVE_INFINITY) endIndex = findLeft(newEndPos)
        return slice(beginIndex, newBeginPos, endIndex, newEndPos)
    }

    /**
     * Cuts an envelope part, interpolating new points if required.
     *
     * @param beginStepIndex the index of a step beginPosition belongs to
     * @param beginPosition must belong to the step at beginStepIndex
     * @param endStepIndex the index of a step endPosition belongs to
     * @param endPosition must belong to the step at beginStepIndex
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    fun slice(
        beginStepIndex: Int,
        beginPosition: Double,
        endStepIndex: Int,
        endPosition: Double,
    ): EnvelopePart? {
        return slice(
            beginStepIndex,
            beginPosition,
            Double.NaN,
            endStepIndex,
            endPosition,
            Double.NaN,
        )
    }

    /**
     * Cuts an envelope part, interpolating new points if required.
     *
     * @param beginStepIndex the index of a step beginPosition belongs to
     * @param beginPosition must belong to the step at beginStepIndex
     * @param beginSpeed the forced start speed of the envelope slice
     * @param endStepIndex the index of a step endPosition belongs to
     * @param endPosition must belong to the step at beginStepIndex
     * @param endSpeed the forced end speed of the envelope slice
     * @return an EnvelopePart spanning from beginPosition to endPosition
     */
    fun slice(
        beginStepIndex: Int,
        beginPosition: Double,
        beginSpeed: Double,
        endStepIndex: Int,
        endPosition: Double,
        endSpeed: Double,
    ): EnvelopePart? {
        var newBeginStepIndex = beginStepIndex
        var newBeginPos = beginPosition
        var newBeginSpeed = beginSpeed
        var newEndStepIndex = endStepIndex
        var newEndPos = endPosition
        var newEndSpeed = endSpeed
        assert(newEndStepIndex >= 0 && newEndStepIndex < stepCount())
        assert(newBeginStepIndex >= 0 && newBeginStepIndex < stepCount())

        // remove empty ranges from the slice and avoid needless interpolations
        if (newEndPos == getBeginPos(newEndStepIndex)) {
            newEndPos = Double.POSITIVE_INFINITY
            newEndStepIndex -= 1
        } else if (newEndPos == getEndPos(newEndStepIndex)) newEndPos = Double.POSITIVE_INFINITY
        if (newBeginPos == getEndPos(newBeginStepIndex)) {
            newBeginPos = Double.NEGATIVE_INFINITY
            newBeginStepIndex += 1
        } else if (newBeginPos == getBeginPos(newBeginStepIndex))
            newBeginPos = Double.NEGATIVE_INFINITY

        // if the slice spans all the envelope part, don't make a copy
        if (
            newBeginStepIndex == 0 &&
                newEndStepIndex == stepCount() - 1 &&
                newBeginPos == Double.NEGATIVE_INFINITY &&
                newEndPos == Double.POSITIVE_INFINITY &&
                isNaN(newBeginSpeed) &&
                isNaN(newEndSpeed)
        )
            return this

        // copy affected steps
        val sliced = sliceIndex(newBeginStepIndex, newEndStepIndex + 1) ?: return null

        // interpolate if necessary
        if (newEndPos != Double.POSITIVE_INFINITY) {
            if (isNaN(newEndSpeed)) newEndSpeed = interpolateSpeed(newEndStepIndex, newEndPos)
            val interpolatedTimeDelta = interpolateTimeDelta(newEndStepIndex, newEndPos)
            sliced.positions[sliced.pointCount() - 1] = newEndPos
            sliced.timeDeltas[sliced.stepCount() - 1] = interpolatedTimeDelta
        }
        if (newBeginPos != Double.NEGATIVE_INFINITY) {
            if (isNaN(newBeginSpeed))
                newBeginSpeed = interpolateSpeed(newBeginStepIndex, newBeginPos)
            val interpolatedTimeDelta = interpolateTimeDelta(newBeginStepIndex, newBeginPos)
            sliced.positions[0] = newBeginPos
            sliced.timeDeltas[0] -= interpolatedTimeDelta // notice the -= here
        }
        if (!isNaN(newBeginSpeed)) sliced.speeds[0] = newBeginSpeed
        if (!isNaN(newEndSpeed)) sliced.speeds[sliced.pointCount() - 1] = newEndSpeed
        sliced.runSanityChecks()
        return sliced
    }

    /**
     * Returns a new EnvelopePart, where all positions are shifted by positionDelta. Resulting
     * positions are clipped to [minPosition; maxPosition].
     */
    fun copyAndShift(
        positionDelta: Double,
        minPosition: Double,
        maxPosition: Double,
    ): EnvelopePart {
        val newPositions = DoubleArrayList()
        val newSpeeds = DoubleArrayList()
        val newTimeDeltas = DoubleArrayList()
        newPositions.add(positions[0] + positionDelta)
        newSpeeds.add(speeds[0])
        for (i in 1 until positions.size) {
            val p = max(minPosition, min(maxPosition, positions[i] + positionDelta))
            if (newPositions.last().value != p) {
                // Positions that are an epsilon away may be overlapping after the shift, we only
                // add the distinct ones
                newPositions.add(p)
                newSpeeds.add(speeds[i])
                newTimeDeltas.add(timeDeltas[i - 1])
            }
        }
        return EnvelopePart(
            HashMap(attrs),
            newPositions.toArray(),
            newSpeeds.toArray(),
            newTimeDeltas.toArray(),
        )
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || javaClass != other.javaClass) return false
        val that = other as EnvelopePart
        return (attrs == that.attrs &&
            positions.contentEquals(that.positions) &&
            speeds.contentEquals(that.speeds) &&
            timeDeltas.contentEquals(that.timeDeltas))
    }

    override fun hashCode(): Int {
        var result = attrs.hashCode()
        result = 31 * result + positions.contentHashCode()
        result = 31 * result + speeds.contentHashCode()
        result = 31 * result + timeDeltas.contentHashCode()
        return result
    }

    override fun toString(): String {
        val attrsRepr =
            attrs.entries
                .stream()
                .map { item: Map.Entry<Class<out SelfTypeHolder>, SelfTypeHolder> ->
                    String.format("%s=%s", item.key.simpleName, item.value)
                }
                .collect(Collectors.joining(", "))
        return String.format("EnvelopePart { %s }", attrsRepr)
    }

    companion object {
        /** Creates an envelope part by generating step times from speeds and positions */
        @JvmStatic
        fun generateTimes(
            attrs: Iterable<SelfTypeHolder>,
            positions: DoubleArray,
            speeds: DoubleArray,
        ): EnvelopePart {
            return EnvelopePart(attrs, positions, speeds, computeTimes(positions, speeds))
        }

        /** Create an attribute map from the given attributes */
        fun makeAttrs(
            attrs: Iterable<SelfTypeHolder>
        ): Map<Class<out SelfTypeHolder>, SelfTypeHolder> {
            val res = HashMap<Class<out SelfTypeHolder>, SelfTypeHolder>()
            for (attr in attrs) res[attr.selfType] = attr
            return res
        }

        private fun checkNaNFree(values: DoubleArray): Boolean {
            for (`val` in values) if (isNaN(`val`)) return false
            return true
        }

        private fun checkPositive(values: DoubleArray): Boolean {
            for (`val` in values) if (`val` < 0) return false
            return true
        }

        private fun checkStrictlyMonotonicIncreasing(values: DoubleArray): Boolean {
            for (i in 0 until values.size - 1) if (values[i] >= values[i + 1]) return false
            return true
        }

        private fun checkStrictlyMonotonicDecreasing(values: DoubleArray): Boolean {
            for (i in 0 until values.size - 1) if (values[i] <= values[i + 1]) return false
            return true
        }

        private fun checkStrictlyMonotonic(values: DoubleArray): Boolean {
            return checkStrictlyMonotonicIncreasing(values) ||
                checkStrictlyMonotonicDecreasing(values)
        }

        /** Compute the time deltas between positions */
        private fun computeTimes(positions: DoubleArray, speeds: DoubleArray): DoubleArray {
            val timeDeltas = DoubleArray(positions.size - 1)
            for (i in 0 until positions.size - 1) {
                val posDelta = positions[i + 1] - positions[i]
                timeDeltas[i] =
                    EnvelopePhysics.interpolateStepTime(
                        positions[i],
                        positions[i + 1],
                        speeds[i],
                        speeds[i + 1],
                        posDelta,
                    )
            }
            return timeDeltas
        }

        /** Check if a is in the interval [b, c] or [c, b] */
        private fun isBetween(a: Double, b: Double, c: Double): Boolean {
            val min = min(b, c)
            val max = max(b, c)
            return a in min..max
        }
    }
}

/**
 * Compute the minimum EnvelopePart between 2 envelope parts starting and ending at the exact same
 * positions.
 */
fun minEnvelopeParts(
    envelopePartA: EnvelopePart,
    envelopePartB: EnvelopePart,
    attrs: Iterable<SelfTypeHolder>,
): EnvelopePart {
    assert(envelopePartA.beginPos == envelopePartB.beginPos)
    assert(envelopePartA.endPos == envelopePartB.endPos)

    val keyPositions = TreeSet(envelopePartA.getPositions())
    keyPositions.addAll(envelopePartB.getPositions())
    val keyPosList = ArrayList(keyPositions)

    val newPositions = DoubleArrayList()
    val newSpeeds = DoubleArrayList()
    var prevPos: Double? = null
    var prevSpeedA: Double? = null
    var prevSpeedB: Double? = null
    for (i in keyPosList.indices) {
        val pos = keyPosList[i]
        val speedA = envelopePartA.interpolateSpeed(pos)
        val speedB = envelopePartB.interpolateSpeed(pos)
        val minSpeedAtPos = min(speedA, speedB)

        if (prevPos != null && prevSpeedA != null && prevSpeedB != null) {
            if ((prevSpeedA - prevSpeedB) * (speedA - speedB) < 0) {
                val intersection =
                    EnvelopePhysics.intersectSteps(
                        prevPos,
                        prevSpeedA,
                        pos,
                        speedA,
                        prevPos,
                        prevSpeedB,
                        pos,
                        speedB,
                    )
                // Add intersection point if it isn't either the previous or the current position.
                if (
                    !arePositionsEqual(intersection.position, pos) &&
                        !arePositionsEqual(intersection.position, prevPos)
                ) {
                    newPositions.add(intersection.position)
                    newSpeeds.add(intersection.speed)
                }
            }
        }
        newPositions.add(pos)
        newSpeeds.add(minSpeedAtPos)
        prevPos = pos
        prevSpeedA = speedA
        prevSpeedB = speedB
    }
    return generateTimes(attrs, newPositions.toArray(), newSpeeds.toArray())
}
