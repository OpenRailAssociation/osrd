package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.dropSeq
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

    /** Returns all the steps that have been passed on the path, in order. */
    fun getSeenSteps(): List<LocatedStep> {
        return seenSteps.toList()
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

        val currentBlockStart: Offset<PhysicsPath> = currentPathOffset - rangeStart.distance
        for (step in inputSteps.dropSeq(nSeenSteps)) {
            val currentPathBlockOffset = Offset<Block>(currentPathOffset - currentBlockStart)
            val location =
                step.locations
                    .filter { it.edge == block }
                    .filter { it.offset in currentPathBlockOffset..rangeEnd }
                    .minByOrNull { it.offset } ?: break
            currentPathOffset = currentBlockStart + location.offset.distance
            val newStep = LocatedStep(currentPathOffset, location, step)
            res.add(newStep)
            seenSteps.add(newStep)
        }
        currentPathOffset = currentBlockStart + rangeEnd.distance
        return res
    }

    /** Integrate a part of the lookahead into the "actually visited" steps. */
    fun moveForward(block: BlockId, start: Offset<Block>, end: Offset<Block>) {
        nStepsExcludingLookahead +=
            getStepsInLookahead()
                .takeWhile { it.location.edge == block && it.location.offset in start..end }
                .count()
    }

    /**
     * Returns the steps that are present in the lookahead (not "reached" yet by the simulation, but
     * we know their path offset)
     */
    fun getStepsInLookahead(): Sequence<LocatedStep> {
        return seenSteps.toList().dropSeq(nStepsExcludingLookahead)
    }

    /** Returns all the steps excluding lookahead, in order. */
    fun getReachedSteps(): List<LocatedStep> {
        return getSeenSteps().take(nStepsExcludingLookahead)
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
}

data class LocatedStep(
    val travelledPathOffset: Offset<PhysicsPath>,
    val location: BlockLocation,
    val originalStep: ExplorerStep,
    val isPlanned: Boolean = true, // Set to false for overtakes (when implemented)
) {
    init {
        assert(originalStep.locations.contains(location))
    }
}
