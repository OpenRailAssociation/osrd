package fr.sncf.osrd.stdcm

import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.units.Distance

/**
 * The given element is unavailable from timeStart until timeEnd, in the space between distanceStart
 * and distanceEnd. Distances are relative to the start of the element.
 */
@JvmRecord
data class OccupancySegment(
    val timeStart: Double,
    val timeEnd: Double,
    val distanceStart: Distance,
    val distanceEnd: Distance,
    val enabledIfBlockInLookahead: BlockId? = null,
    val disabledIfBlockInLookahead: BlockId? = null
)
