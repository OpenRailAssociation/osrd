package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.areTimesEqual
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.PlannedTimingData
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.units.Offset
import kotlin.math.min

data class STDCMNode(
    val timeData: TimeData,
    // Speed at the end of the previous edge
    val speed: Double,
    // Instance used to explore the infra
    val infraExplorer: InfraExplorerWithEnvelope,
    // Edge that lead to this node, null if this is the first node
    val previousEdge: STDCMEdge?,
    // Index of the last waypoint passed by the train
    val waypointIndex: Int,
    // Position on a block, if this node isn't on the transition between blocks (stop)
    val locationOnEdge: Offset<Block>?,
    // When the node is a stop, how long the train remains here
    val stopDuration: Double?,
    // Planned arrival time at node, with its tolerance. Is null at least when the node is not a
    // stop
    val plannedTimingData: PlannedTimingData?,
    // Previous node with non-null PlannedTimingDelta: time difference between arrival time on node
    // and planned arrival time, divided by the total duration of the time window
    val previousPlannedNodeRelativeTimeDiff: Double?,
    // Estimation of the min time it takes to reach the end from this node
    var remainingTimeEstimation: Double,
) : Comparable<STDCMNode> {

    /**
     * Defines the estimated better path between 2 nodes, in the following priority:
     * - lowest total run time
     * - closest planned arrival time, taking the tolerance into account, using the current node's
     *   planned timing data, then the last planned node's timing data
     * - earliest departure time
     * - highest number of reached targets
     *
     * If the result is negative, the current node has a better path, and should be explored first.
     * This method allows us to order the nodes in a priority queue, from the best path to the worst
     * path. We then explore them in that order.
     */
    override fun compareTo(other: STDCMNode): Int {
        val runTimeEstimation = timeData.timeSinceDeparture + remainingTimeEstimation
        val otherRunTimeEstimation =
            other.timeData.timeSinceDeparture + other.remainingTimeEstimation
        val plannedRelativeTimeDiff =
            getRelativeTimeDiff(
                timeData.totalDepartureDelay,
                timeData.maxDepartureDelayingWithoutConflict
            )
        val otherPlannedRelativeTimeDiff =
            other.getRelativeTimeDiff(
                other.timeData.totalDepartureDelay,
                other.timeData.maxDepartureDelayingWithoutConflict
            )
        // Firstly, minimize the total run time: highest priority node takes the least time to
        // complete the path
        return if (!areTimesEqual(runTimeEstimation, otherRunTimeEstimation))
            runTimeEstimation.compareTo(otherRunTimeEstimation)
        // Minimise the difference with the planned arrival times
        else if (
            plannedRelativeTimeDiff != null &&
                otherPlannedRelativeTimeDiff != null &&
                plannedRelativeTimeDiff != otherPlannedRelativeTimeDiff
        )
            (plannedRelativeTimeDiff).compareTo(otherPlannedRelativeTimeDiff)
        // If not, minimise the difference with the planned arrival times at the last planned node
        else if (
            previousPlannedNodeRelativeTimeDiff != null &&
                other.previousPlannedNodeRelativeTimeDiff != null &&
                previousPlannedNodeRelativeTimeDiff != other.previousPlannedNodeRelativeTimeDiff
        )
            previousPlannedNodeRelativeTimeDiff.compareTo(other.previousPlannedNodeRelativeTimeDiff)
        // If not, take the train which departs first, as it is the closest to the demanded
        // departure time
        else if (timeData.earliestReachableTime != other.timeData.earliestReachableTime)
            timeData.earliestReachableTime.compareTo(other.timeData.earliestReachableTime)
        // In the end, prioritize the highest number of reached targets
        else other.waypointIndex - waypointIndex
    }

    override fun toString(): String {
        // Not everything is included, otherwise it may recurse a lot over edges / nodes
        return String.format(
            "time=%s, speed=%s, lastBlock=%s, waypointIndex=%s",
            timeData.earliestReachableTime,
            speed,
            infraExplorer.getCurrentBlock(),
            waypointIndex
        )
    }

    /**
     * Returns the relative time difference between the real arrival time at node and the planned
     * arrival time at node, taking into account the tolerance on either side. It takes the lowest
     * value in the window made of [currentTime; currentTimeWithMaxDelayAdded].
     */
    fun getRelativeTimeDiff(
        currentTotalPrevAddedDelay: Double,
        currentMaximumAddedDelay: Double
    ): Double? {
        // Ex: here, minimum time diff possible is 0.0 => minimum relative time diff will be 0.0.
        //          before         plannedArrival                  after
        // ------------[-----|-----------|----------------|----------]------------
        //               currentTime            currentTimeWithMaxDelay
        if (plannedTimingData != null) {
            val realTime = getRealTime(currentTotalPrevAddedDelay)
            val timeDiff = plannedTimingData.getTimeDiff(realTime)
            val relativeTimeDiff = plannedTimingData.getBeforeOrAfterRelativeTimeDiff(timeDiff)
            // If time diff is positive, adding delay won't decrease relative time diff: return
            // relativeTimeDiff
            if (timeDiff >= 0) return relativeTimeDiff

            val maxTime = getRealTime(currentTotalPrevAddedDelay + currentMaximumAddedDelay)
            val maxTimeDiff =
                min(
                    plannedTimingData.getTimeDiff(maxTime),
                    plannedTimingData.arrivalTimeToleranceAfter.seconds
                )
            val relativeMaxTimeDiff =
                plannedTimingData.getBeforeOrAfterRelativeTimeDiff(maxTimeDiff)
            // If time diff < 0.0 and maxTimeDiff >= 0.0, then we can add delay to make the node
            // arrive at planned arrival time: return 0.0
            if (maxTimeDiff >= 0.0) return 0.0

            // Else, both are < 0.0: return the lowest relative time diff, i.e., relativeMaxTimeDiff
            return relativeMaxTimeDiff
        }
        return null
    }

    /**
     * Takes into account the real current departure time shift to return the real current time at
     * which the train arrives at this node.
     */
    fun getRealTime(currentTotalAddedDelay: Double): Double {
        assert(currentTotalAddedDelay >= timeData.totalDepartureDelay)
        return timeData.earliestReachableTime +
            (currentTotalAddedDelay - timeData.totalDepartureDelay)
    }
}
