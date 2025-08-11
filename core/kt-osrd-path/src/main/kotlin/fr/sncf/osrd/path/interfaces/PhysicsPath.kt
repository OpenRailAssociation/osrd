package fr.sncf.osrd.path.interfaces

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.RangeMap

/** Legacy interface for the envelope module */
interface PhysicsPath {
    /** The length of the path, in meters */
    val length: Double

    /** The average slope on a given range, in m/km */
    fun getAverageGrade(begin: Double, end: Double): Double

    /** The lowest slope on a given range, in m/km */
    fun getMinGrade(begin: Double, end: Double): Double

    /** Get the electrification related data for a given power class and power restriction map. */
    fun getElectrificationMap(
        basePowerClass: String?,
        powerRestrictionMap: RangeMap<Double, String>?,
        powerRestrictionToPowerClass: Map<String, String>?,
        ignoreElectricalProfiles: Boolean = false,
    ): ImmutableRangeMap<Double, Electrification>
}
