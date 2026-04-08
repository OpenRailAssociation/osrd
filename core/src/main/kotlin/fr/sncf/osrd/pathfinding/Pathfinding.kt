package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.pathfindingLogger
import fr.sncf.osrd.graph.AStarHeuristic
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.pathfinding.constraints.CachedBlockConstraintCombiner
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorers
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder
import fr.sncf.osrd.utils.arePositionsEqual
import fr.sncf.osrd.utils.areTimesEqual
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.time.Duration
import java.time.Instant
import java.util.ArrayList
import java.util.HashMap
import java.util.PriorityQueue
import kotlin.collections.set
import kotlin.math.max

const val SIGNALING_SYSTEM_COST_WEIGHTING = 1e-1

// TODO: Refactor this to remove the list<AStarHeuristic> and better express the intent
//       Probably also completely remove AStarHeuristic interface
@WithSpan(value = "Building heuristic")
private fun makeRemainingDistanceHeuristics(
    infra: FullInfra,
    targets: List<ExplorerStep>,
): ArrayList<AStarHeuristic> {
    // Compute the minimum distance between steps
    val stepMinDistance = Array(targets.size - 1) { 0.meters }
    for (i in 0 until targets.size - 2) {
        stepMinDistance[i] =
            minDistanceBetweenSteps(
                infra.blockInfra,
                infra.rawInfra,
                targets[i + 1].locations,
                targets[i + 2].locations,
            )
    }

    // Reversed cumulative sum
    for (i in stepMinDistance.size - 2 downTo 0) {
        stepMinDistance[i] += stepMinDistance[i + 1]
    }

    // Setup estimators foreach intermediate steps
    val remainingCostEstimators = ArrayList<AStarHeuristic>()
    for (i in 0 until targets.size - 1) {
        val remainingDistanceEstimator =
            RemainingDistanceEstimator(
                infra.blockInfra,
                infra.rawInfra,
                targets[i + 1].locations,
                stepMinDistance[i],
            )

        // Now that the cost function is an approximation of the remaining distance,
        // we need to return the smallest possible remaining distance here
        remainingCostEstimators.add(remainingDistanceEstimator)
    }
    return remainingCostEstimators
}

class Pathfinding(
    val fullInfra: FullInfra,
    val inputTargets: List<ExplorerStep>,
    val constraints: List<PathfindingConstraint>?,
    val speedLimitTag: String?,
    val rollingStockMaxSpeed: Double,
    val rollingStockLength: Distance,
) {
    private val targets =
        inputTargets.mapIndexed { index, it ->
            ExplorerStep(
                it.locations,
                it.duration,
                it.stop,
                if (index > 0 && index < inputTargets.size) it.canBacktrack else false,
                it.plannedTimingData,
            )
        }

    init {
        checkParameters(inputTargets)
    }

    val mrspBuilder: CachedBlockMRSPBuilder =
        CachedBlockMRSPBuilder.getCachedBlockMRSPBuilder(
            fullInfra,
            rollingStockMaxSpeed,
            rollingStockLength.meters,
            speedLimitTag,
        )

    val remainingCostEstimators = makeRemainingDistanceHeuristics(fullInfra, targets)

    private data class Step( // Instance used to explore the infra
        val infraExplorer: InfraExplorer,
        val establishedCost: Double,
        val estimatedRemainingCost: Double,
        val establishedLength: Distance,
    ) : Comparable<Step> {
        val weight: Double = establishedCost + estimatedRemainingCost

        override fun compareTo(other: Step): Int {
            // Note: epsilon-comparisons are done to prevent float-precision errors (especially with
            // different speeds and SIGNALING_SYSTEM_COST_WEIGHTING)
            if (!areTimesEqual(weight, other.weight)) return weight.compareTo(other.weight)
            // favor less uncertain path
            if (!areTimesEqual(estimatedRemainingCost, other.estimatedRemainingCost))
                return estimatedRemainingCost.compareTo(other.estimatedRemainingCost)
            // favor shorter (in distance) path
            if (establishedLength != other.establishedLength)
                return establishedLength.compareTo(other.establishedLength)
            // favor more blocks (hoping that capacity consumed diminishes, could be removed)
            val nbBlocks = infraExplorer.getAllBlocks().size
            val nbOtherBlocks = other.infraExplorer.getAllBlocks().size
            if (nbBlocks != nbOtherBlocks) return -nbBlocks.compareTo(nbOtherBlocks)
            // stable complete discrimination on blocks used (only one optimal way to reach final
            // block)
            return infraExplorer
                .getCurrentBlock()
                .index
                .compareTo(other.infraExplorer.getCurrentBlock().index)
        }
    }

    private fun rangeCost(range: BlockRange): Double {
        val start = mrspBuilder.getBlockTime(range.value, range.objectBegin)
        val end = mrspBuilder.getBlockTime(range.value, range.objectEnd)
        val edgeDuration = end - start
        val signalingSystemPenaltyFactor =
            SIGNALING_SYSTEM_COST_WEIGHTING *
                fullInfra.signalingSimulator.sigModuleManager.getCost(
                    fullInfra.blockInfra.getBlockSignalingSystem(range.value)
                )
        return edgeDuration * (1 + signalingSystemPenaltyFactor)
    }

    private fun remainingCostEstimation(infraExplorer: InfraExplorer): Double {
        if (infraExplorer.getStepTracker().hasSeenDestination()) return 0.0

        val nbSeenSteps = infraExplorer.getStepTracker().getSeenSteps().size
        val currentRange = infraExplorer.getCurrentBlockRange()
        return remainingCostEstimators[nbSeenSteps - 1].apply(
            BlockLocation(currentRange.value, currentRange.objectEnd)
        ) / rollingStockMaxSpeed
    }

    /** Step priority queue */
    private val queue = PriorityQueue<Step>()

    fun runPathfinding(timeout: Double = TIMEOUT): InfraExplorer? {
        val constraintCombiner =
            constraints?.let {
                CachedBlockConstraintCombiner.getCachedConstraintCombiner(fullInfra, it)
            }
        val startTime = Instant.now()
        val seenBlocks = HashMap<BlockId, Int>()

        val startInfraExplorers =
            getStartInfraExplorers(
                fullInfra.rawInfra,
                fullInfra.blockInfra,
                targets,
                constraintCombiner,
            )
        for (infraExplorer in startInfraExplorers) {
            val currentRange = infraExplorer.getCurrentBlockRange()
            registerStep(infraExplorer, rangeCost(currentRange), currentRange.length)
        }

        var maxSeenTarget = 0

        while (true) {
            if (Duration.between(startTime, Instant.now()).toSeconds() >= timeout)
                throw OSRDError(ErrorType.PathfindingTimeoutError)

            val step = queue.poll()

            if (step == null) {
                // Fail :(
                pathfindingLogger.info(
                    "pathfinding failed, # reached waypoints = $maxSeenTarget/${targets.size}"
                )
                return null
            }

            require(step.infraExplorer.getLookahead().isEmpty())

            if (step.infraExplorer.getStepTracker().hasSeenDestination()) {
                // Success!
                require(
                    arePositionsEqual(
                        step.infraExplorer.getAllBlocks().iterateBackwards().sumOf {
                            it.length.meters
                        },
                        step.establishedLength.meters,
                    )
                )
                return step.infraExplorer
            }

            val nbSeenTargets = step.infraExplorer.getStepTracker().getSeenSteps().size
            maxSeenTarget = max(nbSeenTargets, maxSeenTarget)

            val currentBlock = step.infraExplorer.getCurrentBlock()
            if (seenBlocks.getOrDefault(currentBlock, -1) >= nbSeenTargets) {
                pathfindingLogger.trace(
                    "Dropping current search as a more promising search on the same block is already done"
                )
                continue
            }
            seenBlocks[currentBlock] = nbSeenTargets

            step.infraExplorer.cloneAndExtendLookahead().forEach {
                registerStep(it, step.establishedCost, step.establishedLength)
            }
        }
    }

    private fun getStartInfraExplorers(
        rawInfra: RawSignalingInfra,
        blockInfra: BlockInfra,
        targets: List<ExplorerStep>,
        constraints: PathfindingConstraint?,
    ): Collection<InfraExplorer> {
        val res = mutableListOf<InfraExplorer>()
        val firstLocations = targets[0].locations
        for (location in firstLocations) {
            val infraExplorers =
                initInfraExplorers(
                    rawInfra,
                    blockInfra,
                    rollingStockLength,
                    location,
                    targets,
                    constraints?.let { MutableList(targets.size) { _ -> it } },
                )
            res.addAll(infraExplorers)
        }
        return res
    }

    /** Checks that required parameters are set, sets the optional ones to their default values */
    private fun checkParameters(targets: List<ExplorerStep>) {
        if (targets.size < 2)
            throw OSRDError(ErrorType.InvalidSTDCMInputs)
                .withContext("cause", "Not enough steps have been set to find a path")
    }

    /** Registers one step, add the edge to the queue if not already seen */
    private fun registerStep(
        infraExplorer: InfraExplorer,
        prevEstablishedCost: Double,
        prevEstablishedLength: Distance,
    ) {
        var establishedCost = prevEstablishedCost
        var establishedLength = prevEstablishedLength
        while (!infraExplorer.isLookaheadEmpty()) {
            // Move forward and add new current block's estimated cost.
            infraExplorer.moveForward()
            val currentBlockRange = infraExplorer.getCurrentBlockRange()
            establishedCost += rangeCost(currentBlockRange)
            establishedLength += currentBlockRange.length
        }

        val estimatedRemainingCost = remainingCostEstimation(infraExplorer)

        val newStep =
            Step(infraExplorer, establishedCost, estimatedRemainingCost, establishedLength)
        /*
        TODO: restore this block once asserts are disabled in prod.
        It's a nice sanity check but not worth the computation time.
        assert(
            arePositionsEqual(
                newStep.infraExplorer.getAllBlocks().iterateBackwards().sumOf { it.length.meters },
                newStep.establishedLength.meters,
            )
        )
        */
        if (newStep.weight.isFinite()) queue.add(newStep)
    }

    companion object {
        const val TIMEOUT = 180.0
    }
}
