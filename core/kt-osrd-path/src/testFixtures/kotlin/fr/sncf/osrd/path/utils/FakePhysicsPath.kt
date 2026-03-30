package fr.sncf.osrd.path.utils

import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.OffsetRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.meters

class FakePhysicsPath(
    override val length: Double,
    private val averageGradeResult: Double,
    private val minGradeResult: Double,
    private val electrificationResult: DistanceRangeMap<Electrification>,
) : PhysicsPath {
    var lastAverageGradeCall: Pair<Double, Double>? = null
    var lastMinGradeCall: Pair<Double, Double>? = null
    var lastBasePowerClass: String? = null
    var lastPowerRestrictionMap: OffsetRangeMap<PhysicsPath, String>? = null
    var lastPowerRestrictionToPowerClass: Map<String, String>? = null
    var lastIgnoreElectricalProfiles: Boolean? = null

    override fun getAverageGrade(begin: Double, end: Double): Double {
        lastAverageGradeCall = Pair(begin, end)
        return averageGradeResult
    }

    override fun getMinGrade(begin: Double, end: Double): Double {
        lastMinGradeCall = Pair(begin, end)
        return minGradeResult
    }

    override fun getElectrificationMap(
        basePowerClass: String?,
        powerRestrictionMap: OffsetRangeMap<PhysicsPath, String>?,
        powerRestrictionToPowerClass: Map<String, String>?,
        ignoreElectricalProfiles: Boolean,
    ): DistanceRangeMap<Electrification> {
        lastBasePowerClass = basePowerClass
        lastPowerRestrictionMap = powerRestrictionMap
        lastPowerRestrictionToPowerClass = powerRestrictionToPowerClass
        lastIgnoreElectricalProfiles = ignoreElectricalProfiles
        return electrificationResult
    }

    companion object {
        fun flatUnelectrified(length: Double): FakePhysicsPath {
            return FakePhysicsPath(
                length,
                averageGradeResult = 0.0,
                minGradeResult = 0.0,
                electrificationResult =
                    distanceRangeMapOf(
                        DistanceRangeMap.RangeMapEntry(0.0.meters, length.meters, NonElectrified())
                    ),
            )
        }
    }
}
