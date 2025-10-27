package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

/**
 * The given element is unavailable from timeStart until timeEnd, in the space between distanceStart
 * and distanceEnd. Distances are relative to the start of the element.
 */
data class OccupancySegment(
    val timeStart: Double,
    val timeEnd: Double,
    val untypedDistanceStart: Distance,
    val untypedDistanceEnd: Distance,
    val enabledIfBlockInLookahead: BlockId? = null,
    val disabledIfBlockInLookahead: BlockId? = null,
) {
    val distanceStart = Offset<Block>(untypedDistanceStart)
    val distanceEnd = Offset<Block>(untypedDistanceEnd)
}
