package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.utils.DistanceRangeMap

class FlatPath(override val length: Double, private val slope: Double) : PhysicsPath {
    override fun getAverageGrade(begin: Double, end: Double): Double {
        return slope
    }

    override fun getMinGrade(begin: Double, end: Double): Double {
        return slope
    }

    override fun getElectrificationMap(
        basePowerClass: String?,
        powerRestrictionMap: DistanceRangeMap<String>?,
        powerRestrictionToPowerClass: Map<String, String>?,
        ignoreElectricalProfiles: Boolean,
    ): DistanceRangeMap<Electrification> {
        TODO("Not yet implemented")
    }
}
