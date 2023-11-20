package fr.sncf.osrd.graph

import fr.sncf.osrd.utils.units.Distance

/** This interface defines a function that can be used as a heuristic for an A* pathfinding.
 * It takes an edge and an offset on this edge as inputs, and returns an estimation of the remaining distance.  */
fun interface AStarHeuristic<EdgeT> {
    fun apply(edge: EdgeT, offset: Distance): Double
}

/** Defines the cost of an edge range */
fun interface EdgeRangeCost<EdgeT> {
    fun apply(range: Pathfinding.EdgeRange<EdgeT>): Double
}

/** Defines a function that takes an edge and returns its length  */
fun interface EdgeToLength<EdgeT> {
    fun apply(edge: EdgeT): Distance
}

/** Function that takes an edge and returns a collection of ranges,
 * used to define blocked ranges on an edge  */
fun interface EdgeToRanges<EdgeT> {
    fun apply(edge: EdgeT): Collection<Pathfinding.Range>
}

/** Functions that takes an edge and returns the offset of any target for the current step on the edge */
fun interface TargetsOnEdge<EdgeT> {
    fun apply(edge: EdgeT): Collection<Pathfinding.EdgeLocation<EdgeT>>
}

/** Alternate way to define the cost: returns the absolute cost of a location on an edge */
fun interface TotalCostUntilEdgeLocation<EdgeT> {
    fun apply(edgeLocation: Pathfinding.EdgeLocation<EdgeT>): Double
}
