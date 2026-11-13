package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.api.StepType
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.dropSeq
import fr.sncf.osrd.utils.units.Offset
import kotlin.math.max
import kotlin.time.Duration.Companion.seconds

val FORCED_OP_STOP_DURATION = 60.0.seconds

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
    private val inputSteps: List<ExplorerStep>,
    private val forcedOpStopsByBlockIdSortedByOffset: Map<BlockId, List<ExplorerStep>>,
    private val seenSteps: AppendOnlyLinkedList<LocatedStep> = appendOnlyLinkedListOf(),
) {

    val nSeenInputSteps: Int
        get() = seenSteps.lastOrNull()?.inputStepIndex?.plus(1) ?: 0

    var nStepsExcludingLookahead: Int = 0
        private set

    // Used to compute path offsets
    private var currentPathOffset: Offset<PhysicsPath> = Offset.zero()

    /** Returns all the steps that have been passed on the path. */
    fun getSeenInputSteps(): List<LocatedStep> {
        return seenSteps.toList().filter { it.originalStep.isInput() }
    }

    /** Returns all the steps that have been passed on the path. */
    fun getSeenSteps(): AppendOnlyLinkedList<LocatedStep> {
        return seenSteps
    }

    /** True if the last input step has been encountered (including lookahead). */
    fun hasSeenDestination(): Boolean {
        return nSeenInputSteps == inputSteps.size
    }

    /** True if the last input step has been reached, with full simulation and no lookahead. */
    fun hasReachedDestination(): Boolean {
        assert(nStepsExcludingLookahead <= seenSteps.size)
        return hasSeenDestination() && getCurrentReachedInputStepIndex() + 1 == inputSteps.size
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
        val res = mutableListOf<LocatedStep>()
        var currentInputStepIndex = nSeenInputSteps - 1

        val inputStepToLocation = mutableListOf<Pair<ExplorerStep, BlockLocation>>()
        val forcedOpStopToLocation = mutableListOf<Pair<ExplorerStep, BlockLocation>>()

        val currentBlockStart: Offset<PhysicsPath> =
            currentPathOffset - blockRange.objectBegin.distance
        for (inputStep in inputSteps.dropSeq(nSeenInputSteps)) {
            val currentPathBlockOffset = Offset<Block>(currentPathOffset - currentBlockStart)
            val location =
                inputStep.locations
                    .filter {
                        it.edge == blockRange.value &&
                            it.offset in currentPathBlockOffset..blockRange.objectEnd
                    }
                    .minByOrNull { it.offset } ?: break
            inputStepToLocation.add(Pair(inputStep, location))
            currentPathOffset = currentBlockStart + location.offset.distance
        }

        for (forcedOpStop in forcedOpStopsByBlockIdSortedByOffset[blockRange.value].orEmpty()) {
            val location =
                forcedOpStop.locations
                    .filter {
                        it.offset in blockRange.objectBegin..blockRange.objectEnd
                    }
                    .minByOrNull { it.offset } ?: continue
            forcedOpStopToLocation.add(Pair(forcedOpStop, location))
        }

        while (
            currentInputStepIndex < inputSteps.size - 1 &&
                (inputStepToLocation.isNotEmpty() || forcedOpStopToLocation.isNotEmpty())
        ) {
            val firstInputLocation =
                inputStepToLocation.firstOrNull()?.second?.offset?.distance?.meters
                    ?: Double.POSITIVE_INFINITY
            val firstForcedOpStopLocation =
                forcedOpStopToLocation.firstOrNull()?.second?.offset?.distance?.meters
                    ?: Double.POSITIVE_INFINITY

            val (step, location) =
                if (firstInputLocation <= firstForcedOpStopLocation)
                    inputStepToLocation.removeFirst()
                else forcedOpStopToLocation.removeFirst()
            val stepDuplicate =
                if (res.lastOrNull()?.location == location) res.removeLast() else null
            val isBacktrackingStep =
                isBacktrackingAtEnd && location.offset == blockRange.objectEnd && step.canBacktrack

            val newExplorerStep =
                ExplorerStep(
                    step.locations,
                    // If the step is a backtracking location, it has to mark a stop.
                    duration =
                        if (isBacktrackingStep && step.duration == null) 0.0 else step.duration,
                    step.canBacktrack,
                    step.plannedTimingData,
                    // If the step is a backtracking location, it has to mark a stop.
                    // Question : We could just return step.stepType here as backtracking are only
                    // allowed on stops
                    stepTypes =
                        if (isBacktrackingStep) setOf(StepType.INPUT_STOP) else step.stepTypes,
                )
            if (newExplorerStep.isInput()) currentInputStepIndex++
            val newStep =
                LocatedStep(
                    blockRange.offsetToTrainPath(location.offset),
                    location,
                    newExplorerStep,
                    currentInputStepIndex,
                    isBacktrackingStep,
                )
            res.add(newStep.mergeLocatedStep(stepDuplicate))
            if (isBacktrackingStep) break
        }

        seenSteps.addAll(res)
        assert(!isBacktrackingAtEnd || res.last().isBacktracking)
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

    /** Get the index of the current seen input step */
    fun getCurrentSeenInputStepIndex(): Int {
        return seenSteps.lastOrNull()?.inputStepIndex ?: 0
    }

    /** Get the index of the current reached input step */
    fun getCurrentReachedInputStepIndex(): Int {
        return iterateReachedStepsBackwards().firstOrNull()?.inputStepIndex ?: 0
    }

    fun clone(): StepTracker {
        val res =
            StepTracker(
                inputSteps,
                forcedOpStopsByBlockIdSortedByOffset,
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
            val forcedOpStopsByBlockIdSortedByOffset =
                forcedOpStops
                    .flatMap { step ->
                        step.locations.map { location ->
                            location.edge to (location.offset to step)
                        }
                    }
                    .groupBy({ it.first }, { it.second })
                    .mapValues { (block, stops) ->
                        stops
                            .sortedBy { it.first }
                            .map {
                                it.second
                            }
                            .distinct()
                            .map {
                                ExplorerStep(
                                    locations =
                                        it.locations
                                            .filter { location -> location.edge == block }
                                            .sortedBy(BlockLocation::offset),
                                    duration = it.duration,
                                    canBacktrack = it.canBacktrack,
                                    plannedTimingData = it.plannedTimingData,
                                    stepTypes = it.stepTypes,
                                )
                            }
                    }
            return StepTracker(inputSteps, forcedOpStopsByBlockIdSortedByOffset)
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

    fun mergeLocatedStep(locatedStep: LocatedStep?): LocatedStep {
        if (locatedStep == null) return this

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
        assert(originalStep.locations.contains(location))
        // If the step is a backtracking location, it has to mark a stop.
        assert(!isBacktracking || (originalStep.stop && originalStep.duration != null))
    }
}
