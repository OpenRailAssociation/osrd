package fr.sncf.osrd.envelope_sim

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.RangeMap
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath

class FlatPath(override val length: Double, private val slope: Double) : PhysicsPath {
    override fun getAverageGrade(begin: Double, end: Double): Double {
        return slope
    }

    override fun getMinGrade(begin: Double, end: Double): Double {
        return slope
    }

    override fun getElectrificationMap(
        basePowerClass: String?,
        powerRestrictionMap: RangeMap<Double, String>?,
        powerRestrictionToPowerClass: Map<String, String>?,
        ignoreElectricalProfiles: Boolean,
    ): ImmutableRangeMap<Double, Electrification> {
        TODO("Not yet implemented")
    }
}
