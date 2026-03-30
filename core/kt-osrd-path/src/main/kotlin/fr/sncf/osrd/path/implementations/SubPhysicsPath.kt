package fr.sncf.osrd.path.implementations

import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.OffsetRangeMap
import fr.sncf.osrd.utils.POSITION_EPSILON
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.offsetRangeMapOf
import fr.sncf.osrd.utils.units.meters

class SubPhysicsPath(val begin: Double, val end: Double, val path: PhysicsPath) : PhysicsPath {
    init {
        require(begin in 0.0..<end && end <= path.length + POSITION_EPSILON)
    }

    override val length: Double
        get() = end - begin

    override fun getAverageGrade(begin: Double, end: Double): Double {
        require(end <= this.length)
        require(begin >= 0)
        val newBegin = begin + this.begin
        val newEnd = end + this.begin
        return path.getAverageGrade(newBegin, newEnd)
    }

    override fun getMinGrade(begin: Double, end: Double): Double {
        require(end <= this.length)
        require(begin >= 0)
        val newBegin = begin + this.begin
        val newEnd = end + this.begin
        return path.getMinGrade(newBegin, newEnd)
    }

    override fun getElectrificationMap(
        basePowerClass: String?,
        powerRestrictionMap: OffsetRangeMap<PhysicsPath, String>?,
        powerRestrictionToPowerClass: Map<String, String>?,
        ignoreElectricalProfiles: Boolean,
    ): DistanceRangeMap<Electrification> {
        val newPowerRestrictionMap =
            powerRestrictionMap
                ?.map {
                    OffsetRangeMap.RangeMapEntry(
                        it.lower + begin.meters,
                        it.upper + begin.meters,
                        it.value,
                    )
                }
                ?.let { offsetRangeMapOf(it) }
        val electrificationMap =
            path.getElectrificationMap(
                basePowerClass,
                newPowerRestrictionMap,
                powerRestrictionToPowerClass,
                ignoreElectricalProfiles,
            )
        return electrificationMap
            .map {
                DistanceRangeMap.RangeMapEntry(
                    it.lower - begin.meters,
                    it.upper - begin.meters,
                    it.value,
                )
            }
            .let { distanceRangeMapOf(it) }
    }
}
