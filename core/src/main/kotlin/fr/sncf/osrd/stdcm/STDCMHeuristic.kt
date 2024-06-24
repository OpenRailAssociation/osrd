package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim_infra.MRSP
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.utils.getBlockEntry
import fr.sncf.osrd.stdcm.graph.STDCMEdge
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
import kotlin.math.max
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * This typealias defines a function that can be used as a heuristic for an A* pathfinding. It takes
 * an edge, and offset on this edge, and a number of passed steps as input, and returns an
 * estimation of the remaining time needed to get to the end.
 */
typealias STDCMAStarHeuristic = (STDCMEdge, Offset<Block>?, Int) -> Double
/**
 * This file implements the A* heuristic used by STDCM.
 *
 * Starting at the destination and going backwards in every direction, we cache for each block the
 * minimum time it would take to reach the destination. The remaining time is estimated using the
 * MRSP, ignoring the accelerations and decelerations. We account for the number of steps that have
 * been reached.
 *
 * Because it's optimistic, we know that we still find the best (fastest) solution.
 *
 * It could eventually be improved further by using lookahead or route data, but this adds a fair
 * amount of complexity to the implementation.
 */
class STDCMHeuristicBuilder(
    private val blockInfra: BlockInfra,
    private val rawInfra: RawInfra,
    private val steps: List<STDCMStep>,
    private val maxRunningTime: Double,
    private val rollingStock: PhysicsRollingStock,
) {
    private val logger: Logger = LoggerFactory.getLogger("STDCMHeuristic")

    /** Runs all the pre-processing and initialize the STDCM A* heuristic. */
    fun build(): STDCMAStarHeuristic {
        logger.info("Start building STDCM heuristic...")
        // One map per number of reached pathfinding step
        val maps = mutableListOf<MutableMap<BlockId, Double>>()
        for (i in 0 until steps.size - 1) maps.add(mutableMapOf())

        // Build the cached values
        // We run a kind of Dijkstra, but starting from the end
        val pendingBlocks = initFirstBlocks()
        while (true) {
            val block = pendingBlocks.poll() ?: break
            val index = max(0, block.stepIndex - 1)
            if (maps[index].contains(block.block)) {
                continue
            }
            maps[index][block.block] = block.remainingTimeAtBlockStart
            if (block.stepIndex > 0) {
                pendingBlocks.addAll(getPredecessors(block))
            }
        }
        val bestTravelTime =
            steps.first().locations.minOfOrNull {
                maps.first()[it.edge] ?: Double.POSITIVE_INFINITY
            } ?: Double.POSITIVE_INFINITY
        logger.info("STDCM heuristic built, best theoretical travel time = $bestTravelTime seconds")

        // We build one function (`AStarHeuristic`) per number of reached step
        return res@{ edge, offset, nPassedSteps ->
            // We need to iterate through the previous maps,
            // to handle cases where several steps are on the same block
            for (i in (0..nPassedSteps).reversed()) {
                val cachedRemainingDistance = maps[i][edge.block] ?: continue
                val remainingTime = cachedRemainingDistance - getBlockTime(edge.block, offset)

                return@res remainingTime
            }
            return@res Double.POSITIVE_INFINITY
        }
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
    private fun getPredecessors(
        pendingBlock: PendingBlock,
    ): Collection<PendingBlock> {
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
                    pendingBlock.remainingTimeAtBlockStart
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
        remainingTime: Double
    ): PendingBlock {
        var newIndex = currentIndex
        val actualOffset = offset ?: blockInfra.getBlockLength(block)
        var remainingTimeWithStops = remainingTime
        while (newIndex > 0) {
            val step = steps[newIndex - 1]
            if (step.locations.none { it.edge == block && it.offset <= actualOffset }) {
                break
            }
            if (step.stop) remainingTimeWithStops += step.duration!!
            newIndex--
        }
        return PendingBlock(block, newIndex, remainingTimeWithStops + getBlockTime(block, offset))
    }

    /** Returns the time it takes to go through the given block, until `endOffset` if specified. */
    private fun getBlockTime(
        block: BlockId,
        endOffset: Offset<Block>?,
    ): Double {
        if (endOffset?.distance == 0.meters) return 0.0
        val actualLength = endOffset ?: blockInfra.getBlockLength(block)
        val pathProps =
            makePathProps(blockInfra, rawInfra, block, endOffset = actualLength, routes = listOf())
        val mrsp = MRSP.computeMRSP(pathProps, rollingStock, false, null)
        return mrsp.totalTime
    }
}
