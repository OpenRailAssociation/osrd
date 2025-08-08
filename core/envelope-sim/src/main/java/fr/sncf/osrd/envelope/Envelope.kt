package fr.sncf.osrd.envelope

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.minEnvelopeParts
import fr.sncf.osrd.envelope_utils.DoubleUtils
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.areSpeedsEqual
import java.util.*
import java.util.stream.Stream

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
class Envelope(parts: Array<EnvelopePart>) :
    Iterable<EnvelopePart>, SearchableEnvelope, EnvelopeInterpolate {
    private val parts: Array<EnvelopePart>
    @JvmField val continuous: Boolean

    // region CACHE FIELDS
    /** Contains the position of all transitions, including the beginning and end positions */
    private val partPositions: DoubleArray

    // these two fields could be public, but aren't for the sake of keeping the ability to compute
    // these values lazily
    /** Returns the maximum speed of the envelope */
    /** The highest speed */
    @JvmField val maxSpeed: Double

    /** Returns the minimum speed of the envelope */
    /** The smallest speed */
    @JvmField val minSpeed: Double

    /**
     * The time from the start of the envelope to envelope part transitions, in microseconds. Only
     * read using getTotalTimes.
     */
    private var cumulativeTimesCache: LongArray? = null

    // endregion
    // region CONSTRUCTORS
    init {
        assert(parts.isNotEmpty())

        // check for space and speed continuity. space continuity is mandatory, speed continuity is
        // not
        var continuous = true
        for (i in 0 until parts.size - 1) {
            if (parts[i].endPos != parts[i + 1].beginPos)
                throw OSRDError(ErrorType.EnvelopePartsNotContiguous)
            if (!areSpeedsEqual(parts[i].endSpeed, parts[i + 1].beginSpeed)) continuous = false
        }

        // find the minimum and maximum speeds for all envelope parts
        var minSpeed = Double.POSITIVE_INFINITY
        var maxSpeed = Double.NEGATIVE_INFINITY
        for (part in parts) {
            val partMinSpeed = part.minSpeed
            if (partMinSpeed < minSpeed) minSpeed = partMinSpeed
            val partMaxSpeed = part.maxSpeed
            if (partMaxSpeed > maxSpeed) maxSpeed = partMaxSpeed
        }

        // fill the part transition positions cache
        val partPositions = DoubleArray(parts.size + 1)
        partPositions[0] = parts[0].beginPos
        for (i in parts.indices) partPositions[i + 1] = parts[i].endPos
        this.partPositions = partPositions

        this.parts = parts
        this.continuous = continuous
        this.minSpeed = minSpeed
        this.maxSpeed = maxSpeed
    }

    // endregion
    // region GETTERS
    fun size(): Int {
        return parts.size
    }

    fun get(i: Int): EnvelopePart {
        return parts[i]
    }

    override fun getBeginPos(): Double {
        return parts[0].beginPos
    }

    override fun getEndPos(): Double {
        return parts.last().endPos
    }

    val totalDistance: Double
        get() = endPos - beginPos

    val beginSpeed: Double
        get() = parts[0].beginSpeed

    val endSpeed: Double
        get() = parts.last().endSpeed

    fun getPartPositions(): List<Double> {
        return partPositions.asList()
    }

    // endregion
    // region SEARCH
    override fun binarySearchPositions(position: Double): Int {
        return Arrays.binarySearch(partPositions, position)
    }

    override fun positionPointsCount(): Int {
        return partPositions.size
    }

    // endregion
    // region INTERPOLATION
    /** Returns the interpolated speed at a given position. Assumes the envelope is continuous. */
    fun interpolateSpeed(position: Double): Double {
        assert(continuous) {
            "interpolating speeds on a non continuous envelope is a risky business"
        }
        val envelopePartIndex = findLeft(position)
        assert(envelopePartIndex != -1)
        return get(envelopePartIndex).interpolateSpeed(position)
    }

    /**
     * Interpolates speeds, prefers EnvelopeParts coming from the left, along the given direction
     */
    fun interpolateSpeedLeftDir(position: Double, direction: Double): Double {
        val partIndex = findLeftDir(position, direction)
        return get(partIndex).interpolateSpeed(position)
    }

    /**
     * Interpolates speeds, prefers EnvelopeParts coming from the right, along the given direction
     */
    fun interpolateSpeedRightDir(position: Double, direction: Double): Double {
        val partIndex = findRightDir(position, direction)
        return get(partIndex).interpolateSpeed(position)
    }

    /**
     * Return the maximum speed in the range [beginPos, endPos]. Assumes the envelope is continuous.
     */
    override fun maxSpeedInRange(beginPos: Double, endPos: Double): Double {
        val beginPosition = DoubleUtils.clamp(beginPos, getBeginPos(), getEndPos())
        val endPosition = DoubleUtils.clamp(endPos, getBeginPos(), getEndPos())
        val beginPartIndex = findRight(beginPosition)
        val endPartIndex = findLeft(endPosition)
        var maxSpeed = get(beginPartIndex).interpolateSpeed(beginPosition)
        for (i in beginPartIndex + 1 until endPartIndex) {
            val part = get(i)
            val partMaxSpeed = part.maxSpeed
            if (partMaxSpeed > maxSpeed) maxSpeed = partMaxSpeed
        }
        val endSpeed = get(endPartIndex).interpolateSpeed(endPosition)
        if (endSpeed > maxSpeed) maxSpeed = endSpeed

        return maxSpeed
    }

    private fun interpolateUS(position: Double): Long {
        val envelopePartIndex = findLeft(position)
        assert(envelopePartIndex >= 0) { "Trying to interpolate time outside of the envelope" }
        val envelopePart = get(envelopePartIndex)
        return getCumulativeTimeUS(envelopePartIndex) +
            envelopePart.interpolateTotalTimeUS(position)
    }

    override fun interpolateArrivalAt(position: Double): Double {
        return (interpolateArrivalAtUS(position).toDouble()) / 1000000
    }

    override fun interpolateArrivalAtUS(position: Double): Long {
        return interpolateUS(position)
    }

    override fun interpolateDepartureFrom(position: Double): Double {
        return (interpolateDepartureFromUS(position).toDouble()) / 1000000
    }

    override fun interpolateDepartureFromUS(position: Double): Long {
        return interpolateUS(position)
    }

    override fun interpolateArrivalAtClamp(position: Double): Double {
        return (interpolateArrivalAtUS(DoubleUtils.clamp(position, 0.0, endPos)).toDouble()) /
            1000000
    }

    override fun interpolateDepartureFromClamp(position: Double): Double {
        return (interpolateDepartureFromUS(DoubleUtils.clamp(position, 0.0, endPos)).toDouble()) /
            1000000
    }

    /**
     * Returns the time between the two positions of the envelope (no stop included in envelope, so
     * no problem)
     */
    fun getTimeBetween(beginPos: Double, endPos: Double): Double {
        return interpolateDepartureFrom(endPos) - interpolateDepartureFrom(beginPos)
    }

    // endregion
    // region CACHING
    private val cumulativeTimesUS: LongArray
        /** This method must be private as it returns an array */
        get() {
            if (cumulativeTimesCache != null) return cumulativeTimesCache as LongArray

            val timesToPartTransitions = LongArray(parts.size + 1)
            timesToPartTransitions[0] = 0

            var totalTime: Long = 0
            for (i in parts.indices) {
                totalTime += parts[i].totalTimeUS
                timesToPartTransitions[i + 1] = totalTime
            }
            cumulativeTimesCache = timesToPartTransitions
            return timesToPartTransitions
        }

    private val totalTimeUS: Long
        /** Returns the total time of the envelope, in microseconds */
        get() {
            val timesToPartTransitions = cumulativeTimesUS
            return timesToPartTransitions.last()
        }

    /** Returns the total time of the envelope */
    override fun getTotalTime(): Double {
        return (totalTimeUS.toDouble()) / 1000000
    }

    override fun getRawEnvelopeIfSingle(): Envelope? {
        return this
    }

    /**
     * Returns the total time required to get from the start of the envelope to the start of an
     * envelope part, in microseconds
     *
     * @param transitionIndex either an envelope part index, of the number of parts to get the total
     *   time
     */
    private fun getCumulativeTimeUS(transitionIndex: Int): Long {
        return cumulativeTimesUS[transitionIndex]
    }

    // endregion
    // region SLICING
    /**
     * Cuts an envelope, interpolating new points if required.
     *
     * @return an array of envelope parts spanning from beginPosition to endPosition
     */
    fun slice(beginPosition: Double, endPosition: Double): Array<EnvelopePart> {
        return slice(beginPosition, Double.NaN, endPosition, Double.NaN)
    }

    /**
     * Cuts an envelope, interpolating new points if required.
     *
     * @return an array of envelope parts spanning from beginPosition to endPosition
     */
    fun slice(
        beginPosition: Double,
        beginSpeed: Double,
        endPosition: Double,
        endSpeed: Double,
    ): Array<EnvelopePart> {
        var beginIndex = 0
        var beginPartIndex = 0
        if (beginPosition != Double.NEGATIVE_INFINITY) {
            beginPartIndex = findRight(beginPosition)
            val beginPart = parts[beginPartIndex]
            beginIndex = beginPart.findRight(beginPosition)
        }
        var endPartIndex = parts.size - 1
        var endPart = parts[endPartIndex]
        var endIndex = endPart.stepCount() - 1
        if (endPosition != Double.POSITIVE_INFINITY) {
            endPartIndex = findLeft(endPosition)
            endPart = parts[endPartIndex]
            endIndex = endPart.findLeft(endPosition)
        }
        return slice(
            beginPartIndex,
            beginIndex,
            beginPosition,
            beginSpeed,
            endPartIndex,
            endIndex,
            endPosition,
            endSpeed,
        )
    }

    /** Cuts an envelope */
    fun slice(
        beginPartIndex: Int,
        beginStepIndex: Int,
        beginPosition: Double,
        beginSpeed: Double,
        endPartIndex: Int,
        endStepIndex: Int,
        endPosition: Double,
        endSpeed: Double,
    ): Array<EnvelopePart> {
        assert(beginPartIndex <= endPartIndex)

        if (beginPartIndex == endPartIndex) {
            val part = parts[beginPartIndex]
            val sliced =
                part.slice(
                    beginStepIndex,
                    beginPosition,
                    beginSpeed,
                    endStepIndex,
                    endPosition,
                    endSpeed,
                ) ?: return arrayOf()
            return arrayOf(sliced)
        }

        val beginPart = parts[beginPartIndex]
        val endPart = parts[endPartIndex]
        val beginPartSliced = beginPart.sliceEnd(beginStepIndex, beginPosition, beginSpeed)
        val endPartSliced = endPart.sliceBeginning(endStepIndex, endPosition, endSpeed)

        // compute the number of unchanged envelope parts between sliced parts
        val copySize = endPartIndex - beginPartIndex + 1 - /* sliced endpoints */ 2

        val res = arrayListOf<EnvelopePart>()
        if (beginPartSliced != null) res.add(beginPartSliced)
        val copyStartIndex = beginPartIndex + 1
        for (i in 0 until copySize) res.add(parts[copyStartIndex + i])
        if (endPartSliced != null) res.add(endPartSliced)

        return res.toTypedArray()
    }

    // endregion
    override fun iterator(): MutableIterator<EnvelopePart> {
        return object : MutableIterator<EnvelopePart> {
            private var i = 0

            override fun hasNext(): Boolean {
                return i < parts.size
            }

            override fun next(): EnvelopePart {
                if (!hasNext()) throw NoSuchElementException()
                return parts[i++]
            }

            override fun remove() {
                TODO("Not yet implemented")
            }
        }
    }

    override fun iteratePoints(): List<EnvelopeTimeInterpolate.EnvelopePoint> {
        val res = ArrayList<EnvelopeTimeInterpolate.EnvelopePoint>()
        var time = 0.0
        for (part in this) {
            // Add head position points
            for (i in 0 until part.pointCount()) {
                val pos = part.getPointPos(i)
                val speed = part.getPointSpeed(i)
                res.add(EnvelopeTimeInterpolate.EnvelopePoint(time, speed, pos))
                if (i < part.stepCount()) time += part.getStepTime(i)
            }
        }
        return res
    }

    /** Makes a stream from the parts */
    fun stream(): Stream<EnvelopePart> {
        return Arrays.stream(parts)
    }

    companion object {
        /** Create a new Envelope */
        @JvmStatic
        fun make(vararg parts: EnvelopePart): Envelope {
            return Envelope(arrayOf(*parts))
        }
    }
}

/** Build the min envelopes between 2 envelopes starting and ending at the exact same positions. */
fun minEnvelopes(envelopeA: Envelope, envelopeB: Envelope): Envelope {
    val minParts = mutableListOf<EnvelopePart>()
    assert(envelopeA.beginPos == envelopeB.beginPos)
    assert(envelopeA.endPos == envelopeB.endPos)

    val keyPositions = TreeSet(envelopeA.getPartPositions())
    keyPositions.addAll(envelopeB.getPartPositions())
    val keyPosList = ArrayList(keyPositions)
    for (i in 0 until keyPosList.size - 1) {
        val beginPos = keyPosList[i]
        val endPos = keyPosList[i + 1]
        val slicedEnvelopeA = envelopeA.get(envelopeA.findRight(beginPos)).slice(beginPos, endPos)!!
        val slicedEnvelopeB = envelopeB.get(envelopeB.findRight(beginPos)).slice(beginPos, endPos)!!
        minParts.add(
            minEnvelopeParts(slicedEnvelopeA, slicedEnvelopeB, slicedEnvelopeA.getAttrs().values)
        )
    }
    return Envelope(minParts.toTypedArray())
}
