package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.dropSeq
import fr.sncf.osrd.utils.units.Offset
import kotlin.math.max

const val FORCED_OP_STOP_TIME = 1000.0

/**
 * Component of `InfraExplorer` in charge of keeping track of anything related to the input steps.
 * It keeps tracks of which steps we've passed and where, how many steps have been reached
 * (specifically when we've reached the destination), and which steps are present in a block range.
 *
 * The tricky part is that we need to keep track of which steps are seen on the path as a whole
 * (including lookahead), and which have actually been reached by the simulations (excluding
 * lookahead). As the simulation is managed outside the StepTracker, the simulator is in charge of
 * moving the StepTracker forward, which updates the reached steps.
 *
 * Unless specified otherwise, fields and methods refer to the whole path (including lookahead).
 */
class StepTracker(
    private val inputSteps: List<ExplorerStep>,
    private val forcedOpStopLocations: Set<BlockLocation>,
    private val seenSteps: AppendOnlyLinkedList<LocatedStep> = appendOnlyLinkedListOf(),
    private val seenForcedOpStops: AppendOnlyLinkedList<LocatedStep> = appendOnlyLinkedListOf(),
) {
    private val nSeenSteps: Int
        get() = seenSteps.size

    private val nSeenForcedOpStops: Int
        get() = seenForcedOpStops.size

    var nStepsExcludingLookahead: Int = 0
        private set

    var nForcedOpStopsExcludingLookahead: Int = 0
        private set

    // Used to compute path offsets
    private var currentPathOffset: Offset<PhysicsPath> = Offset.zero()

    /** Returns all the steps that have been passed on the path. */
    fun getSeenSteps(): AppendOnlyLinkedList<LocatedStep> {
        return seenSteps
    }

    /** Returns all the forced op stops that have been passed on the path. */
    fun getSeenForcedOpStops(): AppendOnlyLinkedList<LocatedStep> {
        return seenForcedOpStops
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
        isBacktrackingAtEnd: Boolean,
    ): List<LocatedStep> {
        val res = mutableListOf<LocatedStep>()

        val currentBlockStart: Offset<PhysicsPath> = currentPathOffset - rangeStart.distance

        val forcedOpStops =
            forcedOpStopLocations
                .filter { it.edge == block }
                .filter { it.offset in rangeStart..rangeEnd }
                .map {
                    val explorerStep =
                        ExplorerStep(
                            setOf(it),
                            FORCED_OP_STOP_TIME,
                            true,
                        )
                    LocatedStep(
                        currentBlockStart + it.offset.distance,
                        it,
                        explorerStep,
                        isForcedOpStop = true,
                    )
                }
                .sortedBy { it.travelledPathOffset }

        seenForcedOpStops.addAll(forcedOpStops)

        for (step in inputSteps.dropSeq(nSeenSteps)) {
            val currentPathBlockOffset = Offset<Block>(currentPathOffset - currentBlockStart)
            val location =
                step.locations
                    .filter { it.edge == block }
                    .filter { it.offset in currentPathBlockOffset..rangeEnd }
                    .minByOrNull { it.offset } ?: break
            currentPathOffset = currentBlockStart + location.offset.distance

            val isBacktrackingStep =
                isBacktrackingAtEnd && location.offset == rangeEnd && step.canBacktrack
            val explorerStep =
                ExplorerStep(
                    step.locations,
                    // If the step is a backtracking location, it has to mark a stop.
                    duration =
                        if (isBacktrackingStep && step.duration == null) 0.0 else step.duration,
                    stop = step.stop || isBacktrackingStep,
                    step.canBacktrack,
                    step.plannedTimingData,
                )

            val newStep =
                LocatedStep(currentPathOffset, location, explorerStep, true, isBacktrackingStep)
            res.add(newStep)
            seenSteps.add(newStep)
            if (isBacktrackingStep) break
        }
        assert(!isBacktrackingAtEnd || res.last().isBacktracking)
        currentPathOffset = currentBlockStart + rangeEnd.distance
        return res
    }

    /** Integrate a part of the lookahead into the "actually visited" steps. */
    fun moveForward(block: BlockId, start: Offset<Block>, end: Offset<Block>) {
        val nStepsStillInLookahead =
            1 +
                iterateStepsInLookaheadBackwards().indexOfLast {
                    !(it.location.edge == block && it.location.offset in start..end)
                }
        nStepsExcludingLookahead = nSeenSteps - nStepsStillInLookahead
        val nForcedOpStopsStillInLookahead =
            1 +
                iterateForcedOpStopsInLookaheadBackwards().indexOfLast {
                    !(it.location.edge == block && it.location.offset in start..end)
                }
        nForcedOpStopsExcludingLookahead = nSeenForcedOpStops - nForcedOpStopsStillInLookahead
    }

    /**
     * Returns the steps that are present in the lookahead (not "reached" yet by the simulation, but
     * we know their path offset), in reverse order
     */
    fun iterateStepsInLookaheadBackwards(): Sequence<LocatedStep> {
        return seenSteps.iterateBackwards().take(seenSteps.size - nStepsExcludingLookahead)
    }

    /**
     * Returns the forced op stops that are present in the lookahead (not "reached" yet by the
     * simulation, but we know their path offset), in reverse order
     */
    fun iterateForcedOpStopsInLookaheadBackwards(): Sequence<LocatedStep> {
        return seenForcedOpStops
            .iterateBackwards()
            .take(seenForcedOpStops.size - nForcedOpStopsExcludingLookahead)
    }

    /** Returns all the steps excluding lookahead, in reverse order. */
    fun iterateReachedStepsBackwards(): Sequence<LocatedStep> {
        return seenSteps.iterateBackwards().drop(seenSteps.size - nStepsExcludingLookahead)
    }

    /**
     * Returns all the steps (including lookahead), in reverse order. More efficient when stopping
     * early.
     */
    fun iterateSeenStepsBackwards(): Sequence<LocatedStep> {
        return seenSteps.iterateBackwards()
    }

    /** Get the index of the current reached step */
    fun getCurrentReachedPlannedStepIndex(): Int {
        return max(0, iterateReachedStepsBackwards().count { it.isPlanned } - 1)
    }

    fun clone(): StepTracker {
        val res =
            StepTracker(
                inputSteps,
                forcedOpStopLocations,
                seenSteps.shallowCopy(),
                seenForcedOpStops.shallowCopy(),
            )
        res.currentPathOffset = currentPathOffset
        res.nStepsExcludingLookahead = nStepsExcludingLookahead
        res.nForcedOpStopsExcludingLookahead = nForcedOpStopsExcludingLookahead
        return res
    }
}

data class LocatedStep(
    val travelledPathOffset: Offset<PhysicsPath>,
    val location: BlockLocation,
    val originalStep: ExplorerStep,
    val isPlanned: Boolean = true, // Set to false for overtakes (when implemented)
    // /!\ A step can allow backtracking but actually not backtrack /!\
    val isBacktracking: Boolean = false,
    val isForcedOpStop: Boolean = false,
) {
    init {
        assert(originalStep.locations.contains(location))
        // If the step is a backtracking location, it has to mark a stop.
        assert(!isBacktracking || (originalStep.stop && originalStep.duration != null))
    }
}
