package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.dropSeq
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

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
    private val seenSteps: AppendOnlyLinkedList<LocatedStep> = appendOnlyLinkedListOf(),
) {
    private val nSeenSteps: Int
        get() = seenSteps.size

    var nStepsExcludingLookahead: Int = 0
        private set

    // Used to compute path offsets
    private var currentPathOffset: Offset<PhysicsPath> = Offset.zero()

    /** Returns all the steps that have been passed on the path. */
    fun getSeenSteps(): AppendOnlyLinkedList<LocatedStep> {
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
        isBacktrackingAtEnd: Boolean,
    ): List<LocatedStep> {
        val res = mutableListOf<LocatedStep>()

        val currentBlockStart: Offset<PhysicsPath> = currentPathOffset - rangeStart.distance
        for (step in inputSteps.dropSeq(nSeenSteps)) {
            val currentPathBlockOffset = Offset<Block>(currentPathOffset - currentBlockStart)
            val location =
                step.locations
                    .filter { it.edge == block }
                    .filter { it.offset in currentPathBlockOffset..rangeEnd }
                    .minByOrNull { it.offset } ?: break
            currentPathOffset = currentBlockStart + location.offset.distance

            // TODO PEB: use real backtracking flag, not only "step.stop"
            val isBacktrackingStep = isBacktrackingAtEnd && location.offset == rangeEnd && step.stop

            val newStep = LocatedStep(currentPathOffset, location, step, true, isBacktrackingStep)
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
    }

    /**
     * Returns the steps that are present in the lookahead (not "reached" yet by the simulation, but
     * we know their path offset), in reverse order
     */
    fun iterateStepsInLookaheadBackwards(): Sequence<LocatedStep> {
        return seenSteps.iterateBackwards().take(seenSteps.size - nStepsExcludingLookahead)
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

    fun clone(): StepTracker {
        val res = StepTracker(inputSteps, seenSteps.shallowCopy())
        res.currentPathOffset = currentPathOffset
        res.nStepsExcludingLookahead = nStepsExcludingLookahead
        return res
    }

    fun cloneInsertingInputStep(extraStep: ExplorerStep, previousStep: ExplorerStep): StepTracker {
        val prevIndex = inputSteps.indexOfFirst { it == previousStep }
        assert(prevIndex >= 0)

        val newInputSteps = inputSteps.toMutableList()
        newInputSteps.add(prevIndex + 1, extraStep)

        val res = StepTracker(newInputSteps, seenSteps.shallowCopy())
        res.currentPathOffset = currentPathOffset
        res.nStepsExcludingLookahead = nStepsExcludingLookahead
        return res
    }

    fun cloneCleaningTeleportStep(): StepTracker {

        val newInputSteps = mutableListOf<ExplorerStep>()
        val newSeenSteps = appendOnlyLinkedListOf<LocatedStep>()

        var nbTeleportsExcludingLookahead = 0
        var cumulatedTeleportDistance = 0.meters
        var offsetPrevBacktracking: Offset<PhysicsPath>? = null
        val seenStepList = seenSteps.toList()
        for ((seenStepIndex, seenStep) in seenStepList.withIndex()) {
            if (offsetPrevBacktracking == null) {
                newInputSteps.add(inputSteps[seenStepIndex])
                newSeenSteps.add(
                    LocatedStep(
                        seenStep.travelledPathOffset - cumulatedTeleportDistance,
                        seenStep.location,
                        seenStep.originalStep,
                        seenStep.isPlanned,
                        seenStep.isBacktracking,
                    )
                )
            } else {
                cumulatedTeleportDistance +=
                    seenStep.travelledPathOffset.distance - offsetPrevBacktracking.distance
                if (seenStepIndex <= nStepsExcludingLookahead) nbTeleportsExcludingLookahead++
            }
            offsetPrevBacktracking =
                if (seenStep.isBacktracking) seenStep.travelledPathOffset else null
        }

        val res = StepTracker(newInputSteps, newSeenSteps)
        res.currentPathOffset = currentPathOffset - cumulatedTeleportDistance
        res.nStepsExcludingLookahead = nStepsExcludingLookahead - nbTeleportsExcludingLookahead

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
) {
    init {
        assert(originalStep.locations.contains(location))
    }
}
