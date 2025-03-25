package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.TravelledPath
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.utils.units.Offset

/**
 * Component of `InfraExplorer` in charge of keeping track of anything related to the input steps.
 * It keeps tracks of which steps we've passed and where, how many steps have been reached
 * (specifically when we've reached the destination), and which steps are present in a block range.
 *
 * The tricky part is that we need to keep track of which steps are seen on the path as a whole
 * (including lookahead), and which have actually been reached by the simulations (excluding
 * lookahead).
 *
 * Unless specified otherwise, fields and methods refer to the whole path (including lookahead).
 */
class StepTracker(private val inputSteps: List<STDCMStep>) {
    // If copying this is too expensive, it may be changed to an AppendOnlyLinkedList.
    // But the list should be small.
    private val seenSteps: MutableList<LocatedStep> = mutableListOf()
    private val nSeenSteps: Int
        get() = seenSteps.size

    var nStepsExcludingLookahead: Int = 0
        private set

    // Used to compute path offsets
    private var currentPathOffset: Offset<TravelledPath> = Offset.zero()

    /** Returns all the steps that have been passed on the path, in order. */
    fun getSeenSteps(): List<LocatedStep> {
        return seenSteps
    }

    /** True if the last step has been encountered (including lookahead). */
    fun hasSeenDestination(): Boolean {
        return nSeenSteps == inputSteps.size
    }

    /** True if the last step has been reached, with full simulation and no lookahead. */
    fun hasReachedDestination(): Boolean {
        assert(nStepsExcludingLookahead <= inputSteps.size)
        return hasSeenDestination() && nStepsExcludingLookahead == inputSteps.size
    }

    /**
     * Go through a block range and register every step in the given range (boundaries included).
     * New steps are first part of the "lookahead" section, and only move to the "visited" section
     * upon `moveForward` calls.
     */
    fun exploreBlockRange(
        block: BlockId,
        rangeStart: Offset<Block>,
        rangeEnd: Offset<Block>, // No default value as we need the infra to know the block len
    ): List<LocatedStep> {
        val res = mutableListOf<LocatedStep>()

        val currentBlockStart: Offset<TravelledPath> = currentPathOffset - rangeStart.distance
        for (step in inputSteps.drop(nSeenSteps)) {
            val currentPathBlockOffset = Offset<Block>(currentPathOffset - currentBlockStart)
            val location =
                step.locations
                    .filter { it.edge == block }
                    .filter { it.offset in currentPathBlockOffset..rangeEnd }
                    .minByOrNull { it.offset } ?: break
            currentPathOffset = currentBlockStart + location.offset.distance
            val newStep =
                LocatedStep(
                    currentPathOffset,
                    location,
                    step,
                )
            res.add(newStep)
            seenSteps.add(newStep)
        }
        currentPathOffset = currentBlockStart + rangeEnd.distance
        return res
    }

    /** Integrate a part of the lookahead into the "actually visited" steps. */
    fun moveForward(block: BlockId, start: Offset<Block>, end: Offset<Block>) {
        nStepsExcludingLookahead +=
            seenSteps
                .drop(nStepsExcludingLookahead)
                .takeWhile { it.location.edge == block && it.location.offset in start..end }
                .count()
    }

    /**
     * Returns the steps that are present in the lookahead (not "reached" yet by the simulation, but
     * we know their path offset)
     */
    fun getStepsInLookahead(): List<LocatedStep> {
        return seenSteps.drop(nStepsExcludingLookahead)
    }

    fun clone(): StepTracker {
        // If clone() performances become an issue,
        // reachedSteps can be changed to an AppendOnlyLinkedList
        val res = StepTracker(inputSteps)
        res.seenSteps.addAll(seenSteps)
        res.currentPathOffset = currentPathOffset
        res.nStepsExcludingLookahead = nStepsExcludingLookahead
        return res
    }
}

data class LocatedStep(
    val travelledPathOffset: Offset<TravelledPath>,
    val location: PathfindingEdgeLocationId<Block>,
    val originalStep: STDCMStep,
) {
    init {
        assert(originalStep.locations.contains(location))
    }
}
