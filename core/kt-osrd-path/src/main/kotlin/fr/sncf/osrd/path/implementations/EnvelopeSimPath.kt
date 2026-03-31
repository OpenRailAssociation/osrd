package fr.sncf.osrd.path.implementations

import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.OffsetRangeMap
import fr.sncf.osrd.utils.arePositionsEqual
import fr.sncf.osrd.utils.entries
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import java.util.Arrays

class EnvelopeSimPath(
    length: Double,
    gradePositions: DoubleArray,
    gradeValues: DoubleArray,
    defaultElectrificationMap: DistanceRangeMap<Electrification>,
    electrificationMapByPowerClass: Map<String, DistanceRangeMap<Electrification>>,
) : PhysicsPath {
    override val length: Double

    /** The grade curve points */
    private val gradePositions: DoubleArray

    /** The grade values between each pair of consecutive points */
    private val gradeValues: DoubleArray

    /** The cumulative sum of the gradient at each grade position */
    private val gradeCumSum: DoubleArray

    /**
     * A mapping describing electrification on this path (without electrical profiles nor
     * restrictions)
     */
    private val defaultElectrificationMap: DistanceRangeMap<Electrification>

    /**
     * Mapping from rolling stock power class to mapping describing electrification on this path
     * (without restrictions)
     */
    private val electrificationMapByPowerClass: Map<String, DistanceRangeMap<Electrification>>

    /**
     * Creates a new envelope path, which can be used to perform envelope simulations.
     *
     * @param length the length of the path
     * @param gradePositions the points at which the grade (slope) changes
     * @param gradeValues the values between consecutive pairs of grade positions
     * @param defaultElectrificationMap mapping from distance to electrification conditions
     * @param electrificationMapByPowerClass mapping from rolling stock power class to mapping from
     *   distance to electrification conditions
     */
    init {
        assert(gradePositions.size == gradeValues.size + 1)
        assert(gradePositions[0] == 0.0)
        assert(gradePositions[gradePositions.size - 1] == length)
        for (i in 0..<gradePositions.size - 1) assert(gradePositions[i] < gradePositions[i + 1])
        this.gradePositions = gradePositions
        this.gradeValues = gradeValues
        this.length = length
        this.gradeCumSum = initCumSum(gradePositions, gradeValues)
        assert(defaultElectrificationMap.fullyCovers(length.meters)) {
            "default electrification map does not cover path"
        }
        this.defaultElectrificationMap = defaultElectrificationMap
        for (entry in electrificationMapByPowerClass.entries) assert(
            entry.value.fullyCovers(length.meters)
        ) {
            "electrification map for power class " + entry.key + " does not cover path"
        }
        this.electrificationMapByPowerClass = electrificationMapByPowerClass
    }

    private fun initCumSum(gradePositions: DoubleArray, gradeValues: DoubleArray): DoubleArray {
        val result = DoubleArray(gradePositions.size)
        result[0] = 0.0
        var cumSum = 0.0
        for (i in 0..<gradePositions.size - 1) {
            val rangeLength = gradePositions[i + 1] - gradePositions[i]
            cumSum += gradeValues[i] * rangeLength
            result[i + 1] = cumSum
        }
        return result
    }

    private fun getCumGrade(position: Double): Double {
        var position = position
        if (position > length && arePositionsEqual(position, length)) position = length
        assert(position in 0.0..length)
        val pointIndex = Arrays.binarySearch(gradePositions, position)
        if (pointIndex >= 0) return gradeCumSum[pointIndex]

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        val insertionPoint = -(pointIndex + 1)

        // return the cumulative gradient at the point before the given position, plus the gradient
        // change since then
        val gradeRangeIndex = insertionPoint - 1
        val gradeRangeStart = gradePositions[gradeRangeIndex]
        return gradeCumSum[gradeRangeIndex] +
            gradeValues[gradeRangeIndex] * (position - gradeRangeStart)
    }

    override fun getAverageGrade(begin: Double, end: Double): Double {
        if (begin == end) return getCumGrade(begin)
        return (getCumGrade(end) - getCumGrade(begin)) / (end - begin)
    }

    override fun getMinGrade(begin: Double, end: Double): Double {
        // TODO: Optimise method by adding in a cache.
        val indexBegin = getIndexBeforePos(begin)
        val indexEnd = getIndexBeforePos(end)
        // TODO: Remove if we extend path properties until last SvL > path.length.
        if (
            indexBegin == indexEnd && indexBegin == gradePositions.size - 1
        ) // Take last grade value in this case
         return gradeValues[gradeValues.size - 1]
        var lowestGradient = gradeValues[indexBegin]
        for (i in indexBegin..<indexEnd) {
            val grad = gradeValues[i]
            if (grad < lowestGradient) lowestGradient = grad
        }
        return lowestGradient
    }

    /** For a given position, return the index of the position just before in gradePositions */
    private fun getIndexBeforePos(position: Double): Int {
        // TODO: Optimise method by using binary search.
        if (position <= gradePositions[0]) return 0
        if (position >= gradePositions[gradePositions.size - 1]) return gradePositions.size - 1
        for (i in gradePositions.indices) {
            val pos = gradePositions[i]
            if (pos > position) return i - 1
        }
        return gradePositions.size - 1
    }

    private fun getModeAndProfileMap(
        powerClass: String?,
        lower: Distance,
        upper: Distance,
        ignoreElectricalProfiles: Boolean,
    ): DistanceRangeMap<Electrification> {
        val powerClass = if (ignoreElectricalProfiles) null else powerClass
        return electrificationMapByPowerClass
            .getOrDefault(powerClass, defaultElectrificationMap)
            .subMap(lower, upper)
    }

    /** Get the electrification related data for a given power class and power restriction map. */
    override fun getElectrificationMap(
        basePowerClass: String?,
        powerRestrictionMap: OffsetRangeMap<PhysicsPath, String>?,
        powerRestrictionToPowerClass: Map<String, String>?,
        ignoreElectricalProfiles: Boolean,
    ): DistanceRangeMap<Electrification> {
        val res =
            getModeAndProfileMap(basePowerClass, 0.meters, length.meters, ignoreElectricalProfiles)

        powerRestrictionMap?.forEach { lower, upper, restriction ->
            val powerClass = powerRestrictionToPowerClass?.getOrDefault(restriction, basePowerClass)
            val modeAndProfileMap =
                getModeAndProfileMap(
                    powerClass,
                    lower.distance,
                    upper.distance,
                    ignoreElectricalProfiles,
                )
            for (modeAndProfileEntry in modeAndProfileMap) {
                val electrification = modeAndProfileEntry.value
                res.put(
                    modeAndProfileEntry.lower,
                    modeAndProfileEntry.upper,
                    electrification.withPowerRestriction(restriction),
                )
            }
        }
        return res
    }
}
