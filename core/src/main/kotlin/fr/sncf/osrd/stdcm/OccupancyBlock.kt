package fr.sncf.osrd.stdcm

/** The given element is unavailable from timeStart until timeEnd,
 * in the space between distanceStart and distanceEnd.
 * Distances are relative to the start of the route.  */
@JvmRecord
data class OccupancyBlock(
    @JvmField val timeStart: Double,
    @JvmField val timeEnd: Double,
    @JvmField val distanceStart: Double,
    @JvmField val distanceEnd: Double
)
