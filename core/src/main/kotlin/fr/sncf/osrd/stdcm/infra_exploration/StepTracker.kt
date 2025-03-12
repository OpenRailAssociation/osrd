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
 * Note: compared to the InfraExplorer's progress, this is meant to include the lookahead.
 */
class StepTracker(private val inputSteps: List<STDCMStep>) {
    val totalStepCount: Int = inputSteps.size
    private val reachedSteps: MutableList<LocatedStep> = mutableListOf()
    private val nPassedSteps: Int
        get() = reachedSteps.size

    private var currentPathOffset: Offset<TravelledPath> = Offset.zero()

    /** Returns all the steps that have been passed on the path, in order. */
    fun getAllReachedSteps(): List<LocatedStep> {
        return reachedSteps
    }

    /** True if the last step has been reached. */
    fun hasReachedDestination(): Boolean {
        return nPassedSteps == inputSteps.size
    }

    /**
     * Go through a block range and register every step in the given range (boundaries included).
     * New steps are first part of the "lookahead" section, and only move to the "visited" section
     * upon `moveForward` calls.
     */
    fun exploreBlockRange(
        block: BlockId,
        from: Offset<Block>,
        rangeEnd: Offset<Block>, // No default value as we need the infra to know the block len
    ): List<LocatedStep> {
        val res = mutableListOf<LocatedStep>()
        var rangeStart = from
        while (true) {
            val step = inputSteps.getOrNull(nPassedSteps) ?: break
            val location =
                step.locations
                    .filter { it.edge == block }
                    .filter { it.offset in rangeStart..rangeEnd }
                    .minByOrNull { it.offset } ?: break
            val newStep =
                LocatedStep(
                    currentPathOffset + (location.offset - rangeStart),
                    location,
                    step,
                )
            res.add(newStep)
            reachedSteps.add(newStep)
            currentPathOffset += (location.offset - rangeStart)
            rangeStart = location.offset
        }
        currentPathOffset += (rangeEnd - rangeStart)
        return res
    }

    /** Returns the first step with a stop after the given index, if any. */
    fun getFirstStopAfterIndex(i: Int): LocatedStep? {
        return reachedSteps
            .withIndex()
            .firstOrNull { it.index > i && it.value.originalStep.stop }
            ?.value
    }

    fun clone(): StepTracker {
        // If clone() performances become an issue,
        // reachedSteps can be changed to an AppendOnlyLinkedList
        val res = StepTracker(inputSteps)
        res.reachedSteps.addAll(reachedSteps)
        res.currentPathOffset = currentPathOffset
        return res
    }
}

data class LocatedStep(
    val pathOffset: Offset<TravelledPath>,
    val location: PathfindingEdgeLocationId<Block>,
    val originalStep: STDCMStep,
)
