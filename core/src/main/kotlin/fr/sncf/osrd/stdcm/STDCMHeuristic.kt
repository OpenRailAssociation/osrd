package fr.sncf.osrd.stdcm

import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.sim_infra.utils.getBlockEntry
import fr.sncf.osrd.stdcm.graph.STDCMEdge
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.infra_exploration.StepTracker
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Offset
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.util.*
import kotlin.math.max
import kotlin.math.min
import org.slf4j.Logger
import org.slf4j.LoggerFactory

data class STDCMAStarHeuristic(
    val blockInfra: BlockInfra,
    val remainingTimeEstimations: List<MutableMap<BlockId, Double>>,
    val nPlannedSteps: Int,
    val mrspBuilder: CachedBlockMRSPBuilder,
    val bestTravelTime: Double,
    val allowanceValue: AllowanceValue?,
    val stopDurations: List<Double>,
) {
    /**
     * Defines a function that can be used as a heuristic for an A* pathfinding. It takes an edge,
     * and offset on this edge, and a step tracker as input, and returns an estimation of the
     * remaining time needed to get to the end.
     */
    fun invoke(edge: STDCMEdge, offset: Offset<Block>?, stepTracker: StepTracker): Double {
        val lookahead = edge.infraExplorer.getLookahead()
        val currentBlock = edge.block
        val allBlocks = mutableListOf(currentBlock)
        for (blockRange in lookahead) allBlocks.add(blockRange.value)

        // We don't consider the time of the last lookahead block to avoid issues
        // if it contains the destination, and we don't need it (the destination is
        // already locked-in).

        // Account for the steps that will be passed in the lookahead
        val expectedIndex = getExpectedStepIndex(allBlocks.dropLast(1), stepTracker)
        if (expectedIndex >= remainingTimeEstimations.size) return 0.0

        val timeAfterStartOfLastBlock =
            remainingTimeEstimations[expectedIndex][allBlocks.last()]
                ?: return Double.POSITIVE_INFINITY

        // Compute the time it takes from the current point until the start
        // of the last block of the lookahead, then from that point the destination.
        var timeUntilStartOfLastBlock = 0.0
        for (j in 0 until allBlocks.size - 1) {
            timeUntilStartOfLastBlock +=
                mrspBuilder.getBlockTime(allBlocks[j], null, allowanceValue)
        }
        val timeSinceFirstBlock = mrspBuilder.getBlockTime(edge.block, offset, allowanceValue)
        timeUntilStartOfLastBlock -= timeSinceFirstBlock

        val remainingTime = timeUntilStartOfLastBlock + timeAfterStartOfLastBlock

        return remainingTime
    }

    /** Estimates the minimum remaining stop time. */
    fun minRemainingStopTime(explorer: InfraExplorerWithEnvelope): Double {
        val nSimulatedStops = explorer.generateReachedTrainStops().size
        return stopDurations
            .subList(min(nSimulatedStops, stopDurations.size), stopDurations.size)
            .sum()
    }

    /** Returns the numbers of passed waypoints at the end of the block list */
    private fun getExpectedStepIndex(blocks: List<BlockId>, stepTracker: StepTracker): Int {
        val stepTrackerCopy = stepTracker.clone()
        for (block in blocks) {
            stepTrackerCopy.moveForward(block, Offset.zero(), blockInfra.getBlockLength(block))
        }
        val nPlannedSteps = stepTrackerCopy.getReachedSteps().count { it.isPlanned }
        val res = max(0, nPlannedSteps - 1) // Accounts for the departure step
        return res
    }
}

/**
 * This class builds the A* heuristic used by STDCM.
 *
 * Starting at the destination and going backwards in every direction, we cache for each block the
 * minimum time it would take to reach the destination. The remaining time is estimated using the
 * MRSP, ignoring the accelerations and decelerations. We account for the number of steps that have
 * been reached.
 *
 * Because it's optimistic, we know that we still find the best (fastest) solution.
 */
class STDCMHeuristicBuilder(
    private val blockInfra: BlockInfra,
    private val rawInfra: RawInfra,
    private val steps: List<STDCMStep>,
    private val maxRunningTime: Double,
    private val rollingStock: PhysicsRollingStock,
    private val temporarySpeedLimitManager: TemporarySpeedLimitManager =
        TemporarySpeedLimitManager(),
    private val mrspBuilder: CachedBlockMRSPBuilder,
    val allowance: AllowanceValue?,
) {
    private val logger: Logger = LoggerFactory.getLogger("STDCMHeuristic")

    /** Runs all the pre-processing and initialize the STDCM A* heuristic. */
    @WithSpan(value = "Initializing STDCM heuristic", kind = SpanKind.SERVER)
    fun build(): STDCMAStarHeuristic {
        logger.info("Start building STDCM heuristic...")
        // One map per number of reached pathfinding step
        // maps[n][block] = min time it takes to go from the start of the block to the destination,
        // if we're at the n-th step of the path
        val remainingTimeEstimations = mutableListOf<MutableMap<BlockId, Double>>()
        for (i in 0 until steps.size - 1) remainingTimeEstimations.add(mutableMapOf())

        // Build the cached values
        // We run a kind of Dijkstra, but starting from the end
        val pendingBlocks = initFirstBlocks()
        while (true) {
            val block = pendingBlocks.poll() ?: break
            val index = max(0, block.stepIndex - 1)
            if (remainingTimeEstimations[index].contains(block.block)) {
                continue
            }
            for (i in index until remainingTimeEstimations.size) {
                remainingTimeEstimations[i][block.block] =
                    min(
                        block.remainingTimeAtBlockStart,
                        remainingTimeEstimations[i].getOrDefault(
                            block.block,
                            Double.POSITIVE_INFINITY,
                        ),
                    )
            }
            if (block.stepIndex >= 0) {
                pendingBlocks.addAll(getPredecessors(block))
            }
        }
        val bestTravelTime =
            steps.first().locations.minOfOrNull {
                val remainingTimeSinceBlockStart =
                    remainingTimeEstimations.first()[it.edge] ?: Double.POSITIVE_INFINITY
                val timeSinceBlockStart = mrspBuilder.getBlockTime(it.edge, it.offset, allowance)
                remainingTimeSinceBlockStart - timeSinceBlockStart
            } ?: Double.POSITIVE_INFINITY
        logger.info(
            "STDCM heuristic built, best theoretical travel time = ${bestTravelTime.toInt()} seconds"
        )

        return STDCMAStarHeuristic(
            blockInfra,
            remainingTimeEstimations,
            steps.size,
            mrspBuilder,
            bestTravelTime,
            allowance,
            steps.filter { it.stop }.map { it.duration ?: 0.0 },
        )
    }

    /** Describes a pending block, ready to be added to the cached blocks. */
    private data class PendingBlock(
        val block: BlockId,
        val stepIndex: Int, // Number of steps that have been reached
        val remainingTimeAtBlockStart: Double,
    ) : Comparable<PendingBlock> {
        /** Used to find the lowest remaining time at block start in a priority queue. */
        override fun compareTo(other: PendingBlock): Int {
            return remainingTimeAtBlockStart.compareTo(other.remainingTimeAtBlockStart)
        }
    }

    /**
     * Generates all the pending blocks that can lead to the given block, as long as the pending
     * blocks' remaining times stay below `maximumRunningTime`.
     */
    private fun getPredecessors(pendingBlock: PendingBlock): Collection<PendingBlock> {
        if (pendingBlock.remainingTimeAtBlockStart > maxRunningTime) return emptyList()
        val detector = blockInfra.getBlockEntry(rawInfra, pendingBlock.block)
        val blocks = blockInfra.getBlocksEndingAtDetector(detector)
        val res = mutableListOf<PendingBlock>()
        for (block in blocks) {
            val newBlock =
                makePendingBlock(
                    block,
                    null,
                    pendingBlock.stepIndex,
                    pendingBlock.remainingTimeAtBlockStart,
                )
            res.add(newBlock)
        }
        return res
    }

    /** Initialize the priority queue with the blocks that contain the destination. */
    private fun initFirstBlocks(): PriorityQueue<PendingBlock> {
        val res = PriorityQueue<PendingBlock>()
        val stepCount = steps.size
        for (wp in steps[stepCount - 1].locations) {
            res.add(makePendingBlock(wp.edge, wp.offset, stepCount - 1, 0.0))
        }
        return res
    }

    /** Instantiate one pending block. */
    private fun makePendingBlock(
        block: StaticIdx<Block>,
        offset: Offset<Block>?,
        currentIndex: Int,
        remainingTime: Double,
    ): PendingBlock {
        var newIndex = currentIndex
        val actualOffset = offset ?: blockInfra.getBlockLength(block)
        while (newIndex > 0) {
            val step = steps[newIndex - 1]
            if (step.locations.none { it.edge == block && it.offset <= actualOffset }) {
                break
            }
            newIndex--
        }
        return PendingBlock(
            block,
            newIndex,
            remainingTime + mrspBuilder.getBlockTime(block, offset, allowance),
        )
    }
}
