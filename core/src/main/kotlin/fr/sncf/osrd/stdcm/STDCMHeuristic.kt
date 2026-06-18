package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.ConsistSchedule
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.utils.getBlockEntry
import fr.sncf.osrd.stdcm.graph.STDCMEdge
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.infra_exploration.StepTracker
import fr.sncf.osrd.stdcm.infra_exploration.getOppositeBlockLocations
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
    val maxSpeedEnvBuilder: CachedBlockMaxSpeedEnvBuilder,
    val bestTravelTime: Double,
    val allowanceValue: AllowanceValue?,
    val stopDurations: List<Double>,
) {
    /**
     * Defines a function that can be used as a heuristic for an A* pathfinding. It takes an edge,
     * and offset on this edge, and a step tracker as input, and returns an estimation of the
     * remaining time needed to get to the end. // TODO: we might need to call getBlockTime with the
     * actual offset of the backtracking locations if any.
     */
    fun invoke(edge: STDCMEdge, offset: Offset<Block>?, stepTracker: StepTracker): Double {
        val lookahead = edge.infraExplorer.getLookahead()
        val currentBlock = edge.block
        val allBlocks = mutableListOf(currentBlock)
        for (blockRange in lookahead) allBlocks.add(blockRange.value)

        // We don't consider the time of the last lookahead block to avoid issues
        // if it contains the destination, and we don't need it (the destination is
        // already locked-in).
        val lastBlock = allBlocks.removeLast()

        // Account for the steps that will be passed in the lookahead
        val expectedIndex = getExpectedStepIndex(allBlocks, stepTracker)
        if (expectedIndex >= remainingTimeEstimations.size) return 0.0

        val timeAfterStartOfLastBlock =
            remainingTimeEstimations[expectedIndex][lastBlock] ?: return Double.POSITIVE_INFINITY

        // Compute the time it takes from the current point until the start
        // of the last block of the lookahead, then from that point to the destination.
        var timeUntilStartOfLastBlock = 0.0
        // If we're at the destination, endSpeed should be 0.0 rather than null. However, if we are
        // at the destination, there'll be a stop which is taken into account in MaxSpeedEnvBuilder,
        // so it's fine as is.
        var endSpeed =
            maxSpeedEnvBuilder.getMaxSpeedEnvelope(lastBlock, expectedIndex, null).beginSpeed
        for (block in allBlocks.asReversed()) {
            timeUntilStartOfLastBlock +=
                maxSpeedEnvBuilder.getBlockTime(block, expectedIndex, endSpeed, allowanceValue)
            endSpeed =
                maxSpeedEnvBuilder.getMaxSpeedEnvelope(block, expectedIndex, endSpeed).beginSpeed
        }
        val timeSinceFirstBlock =
            maxSpeedEnvBuilder.getBlockTime(
                edge.block,
                expectedIndex,
                null,
                allowanceValue,
                offset ?: blockInfra.getBlockLength(edge.block),
            )
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
        return stepTrackerCopy.getCurrentReachedPlannedStepIndex()
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
    private val steps: List<ExplorerStep>,
    private val maxRunningTime: Double,
    private val maxSpeedEnvBuilder: CachedBlockMaxSpeedEnvBuilder,
    val allowance: AllowanceValue?,
    private val consistSchedule: ConsistSchedule? = null,
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
        repeat(steps.size) { remainingTimeEstimations.add(mutableMapOf()) }

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
                val timeSinceBlockStart =
                    maxSpeedEnvBuilder.getBlockTime(it.edge, 0, null, allowance, it.offset)
                remainingTimeSinceBlockStart - timeSinceBlockStart
            } ?: Double.POSITIVE_INFINITY
        logger.info(
            "STDCM heuristic built, best theoretical travel time = ${bestTravelTime.toInt()} seconds"
        )

        return STDCMAStarHeuristic(
            blockInfra,
            remainingTimeEstimations,
            steps.size,
            maxSpeedEnvBuilder,
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
        val endSpeed: Double?,
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
        val predecessorEndSpeed =
            if (maxSpeedEnvBuilder.isStopAtStartOfBlock(pendingBlock.block)) 0.0
            else
                maxSpeedEnvBuilder
                    .getMaxSpeedEnvelope(
                        pendingBlock.block,
                        pendingBlock.stepIndex,
                        pendingBlock.endSpeed,
                    )
                    .beginSpeed
        val detector = blockInfra.getBlockEntry(rawInfra, pendingBlock.block)
        val blocks = blockInfra.getBlocksEndingAtDetector(detector)
        val res = mutableListOf<PendingBlock>()
        for (block in blocks) {
            val newStep =
                getNewBlockStep(
                    BlockLocation(block, blockInfra.getBlockLength(block)),
                    pendingBlock.stepIndex,
                )
            if (newStep == null || !steps[newStep.stepIndex].canBacktrack) {
                // The step is unchanged or does not backtrack: the path goes through the whole
                // block.
                val newBlock =
                    makePendingBlock(
                        block,
                        Offset.zero(),
                        blockInfra.getBlockLength(block),
                        newStep?.stepIndex ?: pendingBlock.stepIndex,
                        pendingBlock.remainingTimeAtBlockStart,
                        predecessorEndSpeed,
                    )
                newBlock?.let { res.add(it) }
            } else if (newStep.stepIndex == 0) {
                // We're at the start of the path: start offset should be the exact value.
                val newBlock =
                    makePendingBlock(
                        block,
                        newStep.blockLocation.offset,
                        blockInfra.getBlockLength(block),
                        0,
                        pendingBlock.remainingTimeAtBlockStart,
                        predecessorEndSpeed,
                    )
                newBlock?.let { res.add(it) }
            } else { // The train can backtrack at this location: generate both the current block
                // and its opposite blocks to allow backtracking.
                val newBlock =
                    makePendingBlock(
                        block,
                        // We are starting at the backtrack location: we are building an optimistic
                        // heuristic.
                        newStep.blockLocation.offset,
                        blockInfra.getBlockLength(block),
                        newStep.stepIndex,
                        pendingBlock.remainingTimeAtBlockStart,
                        predecessorEndSpeed,
                    )
                if (newBlock != null) {
                    res.add(newBlock)
                    // Generate the opposing blocks for the backtracking.
                    val oppositeBlockLocations =
                        getOppositeBlockLocations(newStep.blockLocation, blockInfra, rawInfra)
                    for (oppositeBlock in oppositeBlockLocations) {
                        val oppositeBlock =
                            makePendingBlock(
                                oppositeBlock.edge,
                                Offset.zero(),
                                oppositeBlock.offset,
                                newStep.stepIndex,
                                newBlock.remainingTimeAtBlockStart,
                                0.0,
                            )
                        oppositeBlock?.let { res.add(it) }
                    }
                }
            }
        }
        return res
    }

    /** Initialize the priority queue with the blocks that contain the destination. */
    private fun initFirstBlocks(): PriorityQueue<PendingBlock> {
        val res = PriorityQueue<PendingBlock>()
        val stepCount = steps.size
        for (wp in steps[stepCount - 1].locations) {
            val newStep = getNewBlockStep(wp, stepCount - 1)
            makePendingBlock(
                    wp.edge,
                    Offset.zero(),
                    wp.offset,
                    (newStep?.stepIndex) ?: (stepCount - 1),
                    0.0,
                    0.0,
                )
                ?.let { res.add(it) }
        }
        return res
    }

    data class BlockStep(val blockLocation: BlockLocation, val stepIndex: Int)

    /**
     * Find the new step (if any) corresponding to the new block. The step is on the block and is
     * the closest one to the block's start.
     */
    private fun getNewBlockStep(blockLocation: BlockLocation, oldStepIndex: Int): BlockStep? {
        var currentIndex = oldStepIndex
        var currentLocation = blockLocation
        while (currentIndex > 0) {
            val step = steps[currentIndex - 1]
            val currentLocations =
                step.locations.filter {
                    it.edge == currentLocation.edge && it.offset <= currentLocation.offset
                }
            if (currentLocations.isEmpty()) break
            currentLocation = currentLocations.maxBy { it.offset }
            currentIndex--
        }
        return if (currentIndex < oldStepIndex) BlockStep(currentLocation, currentIndex) else null
    }

    /** Instantiate one pending block. */
    private fun makePendingBlock(
        block: BlockId,
        startOffset: Offset<Block>,
        endOffset: Offset<Block>,
        index: Int,
        remainingTime: Double,
        endSpeed: Double?,
    ): PendingBlock? {
        if (
            consistSchedule?.constraints != null &&
                consistSchedule.constraints[index].apply(block).any {
                    it.start < endOffset && it.end > startOffset
                }
        ) {
            return null
        }
        return PendingBlock(
            block,
            index,
            remainingTime +
                maxSpeedEnvBuilder.getBlockTime(
                    block,
                    index,
                    endSpeed,
                    allowance,
                    endOffset,
                    startOffset,
                ),
            endSpeed,
        )
    }
}
