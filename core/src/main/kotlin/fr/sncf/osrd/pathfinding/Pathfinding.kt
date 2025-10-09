package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.graph.AStarHeuristic
import fr.sncf.osrd.graph.Graph
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.utils.units.Offset
import java.util.ArrayList
import java.util.PriorityQueue

/** Contains all the results of a pathfinding */
data class Result<EdgeT, OffsetType>(
    val ranges: List<EdgeRange<EdgeT, OffsetType>>, // Full path as edge ranges
    val waypoints: List<EdgeLocation<EdgeT, OffsetType>>,
)

/** A location on a range, made of edge + offset. Used for the input of the pathfinding */
data class EdgeLocation<EdgeT, OffsetType>(val edge: EdgeT, val offset: Offset<OffsetType>)

/** A range, made of edge + start and end offsets on the edge. Used to provide a cost function. */
// TODO: Remove the use for the output of the pathfinding?
data class EdgeRange<EdgeT, OffsetType>(
    val edge: EdgeT,
    val start: Offset<OffsetType>,
    val end: Offset<OffsetType>,
)

class Pathfinding<NodeT : Any, EdgeT : Any, OffsetType>(
    private val graph: Graph<NodeT, EdgeT, OffsetType>
) {
    /** Pathfinding step */
    private data class PathfindingNode<
        EdgeT : Any,
        OffsetType,
    >( // Instance used to explore the infra
        val infraExplorer: InfraExplorer,
        // Priority queue weight (could be different from totalDistance to allow for A*)
        // TODO: split in 2 parts (one for EstablishedCost, the other for HeuristicAnticipatedCost)
        val weight: Double,
    ) : Comparable<PathfindingNode<EdgeT, OffsetType>> {
        override fun compareTo(other: PathfindingNode<EdgeT, OffsetType>): Int {
            if (weight != other.weight) return weight.compareTo(other.weight)
            return 0
        }
    }

    /** Step priority queue */
    private val queue = PriorityQueue<PathfindingNode<EdgeT, OffsetType>>()

    /**
     * Functions to call to get estimate of the remaining distance. We have a list of function for
     * each step. These functions take the edge and the offset and returns a distance.
     */
    private var estimateRemainingDistance: List<AStarHeuristic<EdgeT, OffsetType>>? = ArrayList()

    /**
     * Function to call to get the cost of a range. Defaults to distances. The heuristic unit *must*
     * match.
     */
    private var rangeCost: (EdgeRange<EdgeT, OffsetType>) -> Double =
        { range: EdgeRange<EdgeT, OffsetType> ->
            (range.end - range.start).millimeters.toDouble()
        }

    /** Timeout, in seconds, to avoid infinite loop when no path can be found. */
    private var timeout = TIMEOUT

    /** Sets the functor used to define the cost of an edge range */
    fun setRangeCost(
        f: (EdgeRange<EdgeT, OffsetType>) -> Double
    ): Pathfinding<NodeT, EdgeT, OffsetType> {
        rangeCost = f
        return this
    }

    /** Sets functors used to estimate the remaining distance for A* */
    fun setRemainingDistanceEstimator(
        f: List<AStarHeuristic<EdgeT, OffsetType>>?
    ): Pathfinding<NodeT, EdgeT, OffsetType> {
        estimateRemainingDistance = f
        return this
    }

    /** Sets the pathfinding's timeout */
    fun setTimeout(timeout: Double?): Pathfinding<NodeT, EdgeT, OffsetType> {
        if (timeout != null) this.timeout = timeout
        return this
    }

    fun runPathfinding(
        targets: List<Collection<EdgeLocation<EdgeT, OffsetType>>>
    ): Result<EdgeT, OffsetType>? {

        return null
    }

    /** Checks that required parameters are set, sets the optional ones to their default values */
    private fun checkParameters(targets: List<Collection<EdgeLocation<EdgeT, OffsetType>>>) {
        assert(estimateRemainingDistance != null)
        if (targets.size < 2)
            throw OSRDError(ErrorType.InvalidSTDCMInputs)
                .withContext("cause", "Not enough steps have been set to find a path")
    }

    companion object {
        const val TIMEOUT = 180.0
    }
}
