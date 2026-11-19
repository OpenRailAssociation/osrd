package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.api.StepType
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.seconds
import kotlin.math.max
import org.slf4j.Logger
import org.slf4j.LoggerFactory

val FORCED_OP_STOP_DURATION = 60.seconds

val stepTrackerLogger: Logger = LoggerFactory.getLogger("StepTracker")

/**
 * Component of `InfraExplorer` in charge of keeping track of anything related to all the steps. It
 * keeps tracks of which steps we've passed and where, how many steps have been reached
 * (specifically when we've reached the destination), and which steps are present in a block range.
 *
 * The tricky part is that we need to keep track of which steps are seen on the path as a whole
 * (including lookahead), and which have actually been reached by the simulations (excluding
 * lookahead). As the simulation is managed outside the StepTracker, the simulator is in charge of
 * moving the StepTracker forward, which updates the reached steps.
 *
 * Unless specified otherwise, fields and methods refer to the whole path (including lookahead).
 */
class StepTracker
private constructor(
    private val nInputSteps: Int,
    // Map of input steps and forced op stops combined with the BlockId as key and its corresponding
    // Explorer Steps sorted by their offset as value.
    // NB: Duplicates on the same block are removed, keeping only the lowest offset (this is not a
    // business rule, just technical convenience).
    private val stepsByBlockIdSortedByOffset: Map<BlockId, List<ExplorerStep>>,
    private val seenSteps: AppendOnlyLinkedList<LocatedStep> = appendOnlyLinkedListOf(),
) {

    val nSeenInputSteps: Int
        get() = seenSteps.lastOrNull()?.inputStepIndex?.plus(1) ?: 0

    var nStepsExcludingLookahead: Int = 0
        private set

    // Used to compute path offsets
    private var currentPathOffset: Offset<PhysicsPath> = Offset.zero()

    /** Returns all the input steps that have been passed on the path. */
    fun getSeenInputSteps(): List<LocatedStep> {
        return seenSteps.toList().filter { it.originalStep.isInput() }
    }

    /** Returns all the steps (input and forced stop) that have been passed on the path. */
    fun getSeenSteps(): AppendOnlyLinkedList<LocatedStep> {
        return seenSteps
    }

    /** True if the last input step has been encountered (including lookahead). */
    fun hasSeenDestination(): Boolean {
        return nSeenInputSteps == nInputSteps
    }

    /** True if the last input step has been reached, with full simulation and no lookahead. */
    fun hasReachedDestination(): Boolean {
        assert(nStepsExcludingLookahead <= seenSteps.size)
        return hasSeenDestination() && getCurrentReachedInputStepIndex() + 1 == nInputSteps
    }

    /**
     * Go through a block range and register every step in the given range (boundaries included).
     * New steps are first part of the "lookahead" section, and only move to the "visited" section
     * upon `moveForward` calls.
     */
    fun exploreBlockRange(
        blockRange: BlockRange,
        isBacktrackingAtEnd: Boolean,
    ): List<LocatedStep> {
        assert(currentPathOffset == blockRange.pathBegin)
        val res = mutableListOf<LocatedStep>()
        var currentInputStepIndex = nSeenInputSteps - 1
        val filteredSteps =
            stepsByBlockIdSortedByOffset[blockRange.value].orEmpty().filter {
                it.locations.single().offset in blockRange.objectBegin..blockRange.objectEnd
            }
        var isBacktrackingStep = false

        for (step in filteredSteps) {
            val location = step.locations.single()
            // If current and previous steps are at the same location, the steps might need to be
            // merged before being added back to the result.
            val isDuplicateLocation = res.lastOrNull()?.location == location

            // When we are on the start of the path, ignore any non-input steps
            if (currentInputStepIndex == 0 && isDuplicateLocation && !step.isInput()) continue
            // Register input steps in the correct order
            if (step.isInput() && step.inputStepIndex != currentInputStepIndex + 1) continue
            // Break if we're at a backtracking step AND the current step is not at the same
            // location as the last one.
            if (isBacktrackingStep && !isDuplicateLocation) break

            if (step.isInput()) currentInputStepIndex++
            isBacktrackingStep =
                isBacktrackingAtEnd && location.offset == blockRange.objectEnd && step.canBacktrack
            if (isBacktrackingStep) assert(step.stepTypes.contains(StepType.INPUT_STOP))

            val newExplorerStep =
                step.copy(
                    // If the step is a backtracking location, it has to mark a stop.
                    duration =
                        if (isBacktrackingStep && step.duration == null) 0.0 else step.duration,
                    // If the step is a backtracking location, it has to mark a stop.
                    // Question : We could just return step.stepType here as backtracking are only
                    // allowed on stops
                    stepTypes = step.stepTypes,
                    inputStepIndex = currentInputStepIndex,
                )
            var newStep =
                LocatedStep(
                    blockRange.offsetToTrainPath(location.offset),
                    location,
                    newExplorerStep,
                    currentInputStepIndex,
                    isBacktrackingStep,
                )

            // If the current and previous steps are at the same location, and are not both inputs,
            // the current and previous steps should be merged together.
            if (
                isDuplicateLocation &&
                    !(newStep.originalStep.isInput() && res.last().originalStep.isInput())
            ) {
                val stepDuplicate = res.removeLast()
                newStep = newStep.mergeLocatedStep(stepDuplicate)
            }
            res.add(newStep)

            // Break when we have reached the destination, to ignore following steps
            if (currentInputStepIndex == nInputSteps - 1) break
        }

        if (isBacktrackingAtEnd) {
            assert(
                res.filter { res.last().location == it.location }.find { it.isBacktracking } !=
                    null,
            )
        }
        seenSteps.addAll(res)
        currentPathOffset = blockRange.pathEnd
        return res
    }

    /** Integrate a part of the lookahead into the "actually visited" steps. */
    fun moveForward(block: BlockId, start: Offset<Block>, end: Offset<Block>) {
        val nStepsStillInLookahead =
            1 +
                iterateStepsInLookaheadBackwards().indexOfLast {
                    !(it.location.edge == block && it.location.offset in start..end)
                }
        nStepsExcludingLookahead = seenSteps.size - nStepsStillInLookahead
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

    /**
     * Get the index of the current seen input step or 0 when seenSteps is empty
     *
     * TODO: This behavior is suspicious, it seems we initialize StepTracker at start locations with
     *   an empty list of seenSteps which should not happen The following issue has been created and
     *   we should look into it : https://github.com/OpenRailAssociation/osrd/issues/19636
     */
    fun getCurrentSeenInputStepIndex(): Int {
        return seenSteps.lastOrNull()?.inputStepIndex ?: 0
    }

    /**
     * Get the index of the current reached input step or 0 when reached steps is empty
     *
     * TODO: check this behavior same as above
     */
    fun getCurrentReachedInputStepIndex(): Int {
        return iterateReachedStepsBackwards().firstOrNull()?.inputStepIndex ?: 0
    }

    fun clone(): StepTracker {
        val res =
            StepTracker(
                nInputSteps,
                stepsByBlockIdSortedByOffset,
                seenSteps.shallowCopy(),
            )
        res.currentPathOffset = currentPathOffset
        res.nStepsExcludingLookahead = nStepsExcludingLookahead
        return res
    }

    companion object {
        fun initStepTracker(
            inputSteps: List<ExplorerStep>,
            forcedOpStops: Collection<ExplorerStep>,
        ): StepTracker {
            val stepsByBlockIdSortedByOffset =
                inputSteps
                    .union(forcedOpStops)
                    .flatMap { step ->
                        step.locations.groupBy(BlockLocation::edge).map { (block, locationsOnBlock)
                            ->
                            if (locationsOnBlock.size > 1) {
                                // We do not allow steps to have multiple locations on the same
                                // block, i.e. locations that can be reached twice in the same path.
                                stepTrackerLogger.warn(
                                    "Step at ${step.inputStepIndex} has ${locationsOnBlock.size} duplicate locations on block $block: keeping the location with the lowest offset.",
                                )
                            }
                            val location = locationsOnBlock.minBy(BlockLocation::offset)
                            block to step.copy(locations = listOf(location))
                        }
                    }
                    .groupBy(
                        keySelector = { (block, _blockSteps) -> block },
                        valueTransform = { (_block, blockSteps) -> blockSteps },
                    )
                    .mapValues { (_, blockSteps) ->
                        blockSteps.sortedBy { it.locations.single().offset }
                    }
            return StepTracker(inputSteps.size, stepsByBlockIdSortedByOffset)
        }
    }
}

data class LocatedStep(
    val travelledPathOffset: Offset<PhysicsPath>,
    val location: BlockLocation,
    val originalStep: ExplorerStep,
    val inputStepIndex: Int,
    // /!\ A step can allow backtracking but actually not backtrack /!\
    val isBacktracking: Boolean = false,
) {

    fun mergeLocatedStep(locatedStep: LocatedStep): LocatedStep {
        assert(travelledPathOffset == locatedStep.travelledPathOffset)
        assert(location == locatedStep.location)

        val newExplorerStep = this.originalStep.mergeExplorerStep(locatedStep.originalStep)
        return LocatedStep(
            travelledPathOffset,
            location,
            newExplorerStep,
            max(inputStepIndex, locatedStep.inputStepIndex),
            isBacktracking = isBacktracking || locatedStep.isBacktracking,
        )
    }

    init {
        assert(originalStep.locations.single() == location)
        // If the step is a backtracking location, it has to mark a stop.
        assert(!isBacktracking || (originalStep.stop && originalStep.duration != null))
    }
}
