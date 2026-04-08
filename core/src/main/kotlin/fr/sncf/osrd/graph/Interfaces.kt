package fr.sncf.osrd.graph

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.utils.units.OffsetRange

/**
 * This interface defines a function that can be used as a heuristic for an A* pathfinding. It takes
 * a block-location as inputs, and returns an estimation of the remaining distance.
 */
fun interface AStarHeuristic {
    fun apply(location: BlockLocation): Double
}

/**
 * Function that takes a block and returns a collection of ranges, used to define blocked
 * (forbidden) ranges on a block
 */
interface PathfindingConstraint {
    fun apply(edge: BlockId): Collection<OffsetRange<Block>>

    /**
     * Returns an identifier describing the constraint and its parameters. Used for caching: results
     * can be reused if the constraint ID matches.
     */
    fun getID(): String
}
