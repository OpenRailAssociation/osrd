package fr.sncf.osrd.graph

import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

/**
 * This interface defines a function that can be used as a heuristic for an A* pathfinding. It takes
 * an edge and an offset on this edge as inputs, and returns an estimation of the remaining
 * distance.
 */
fun interface AStarHeuristic<EdgeT, OffsetType> {
    fun apply(edge: EdgeT, offset: Offset<OffsetType>): Double
}

/** Defines a function that takes an edge and returns its length */
fun interface EdgeToLength<EdgeT, OffsetType> {
    fun apply(edge: EdgeT): Length<OffsetType>
}

/**
 * Function that takes an edge and returns a collection of ranges, used to define blocked ranges on
 * an edge
 */
fun interface EdgeToRanges<EdgeT, OffsetType> {
    fun apply(edge: EdgeT): Collection<Pathfinding.Range<OffsetType>>
}

/**
 * Functions that takes an edge and returns the offset of any target for the current step on the
 * edge
 */
fun interface TargetsOnEdge<EdgeT, OffsetType> {
    fun apply(edge: EdgeT): Collection<Pathfinding.EdgeLocation<EdgeT, OffsetType>>
}

/** Alternate way to define the cost: returns the absolute cost of a location on an edge */
fun interface TotalCostUntilEdgeLocation<EdgeT, OffsetType> {
    fun apply(edgeLocation: Pathfinding.EdgeLocation<EdgeT, OffsetType>): Double
}

// Type aliases to avoid repeating `StaticIdx<T>, T` when edge types are static idx
typealias AStarHeuristicId<T> = AStarHeuristic<StaticIdx<T>, T>

typealias EdgeToLengthId<T> = EdgeToLength<StaticIdx<T>, T>

typealias PathfindingConstraint<T> = EdgeToRanges<StaticIdx<T>, T>

typealias TargetsOnEdgeId<T> = TargetsOnEdge<StaticIdx<T>, T>

typealias TotalCostUntilEdgeLocationId<T> = TotalCostUntilEdgeLocation<StaticIdx<T>, T>
