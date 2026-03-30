package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.ConsistSchedule
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.stdcm.graph.addEndBrakingPart
import fr.sncf.osrd.stdcm.graph.build
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.max
import kotlin.math.min

/**
 * Used to compute block MaxSpeedEnvelopes and min time required to reach a point, with proper
 * caching.
 *
 * TODO: this ignores speed limits by route for now. It would make caching a lot less efficient
 *   though (can't just use block as key), it will have a significant performance cost. Should be
 *   supported once we import them, but not necessarily before that.
 * TODO: rare/unlikely cases could lead to pessimistic evaluation (which could lead to A* providing
 *   a solution different from optimum). Both cases could happen on the same block or different
 *   blocks. /!\ Working on this requires benchmarking and evaluating possible bugs, the amount of
 *   work, technical debt.
 *     - If the path used for heuristic crosses the same stop multiple times (different OP parts)
 *       then we're applying the stop each time while the real simulation will only stop once.
 *     - Same goes on the order of stops if crossing stop places in the wrong order for heuristic,
 *       we're applying too much stops and wrongly slowing down the heuristic.
 */
data class CachedBlockMaxSpeedEnvBuilder(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,
    private val consistSchedule: ConsistSchedule,
    private val steps: List<ExplorerStep>,
    private val timeStep: Double,
    private val comfort: Comfort? = null,
    private val speedLimitTag: String? = null,
    private val temporarySpeedLimitManager: TemporarySpeedLimitManager =
        TemporarySpeedLimitManager(),
    private val addRollingStockLength: Boolean = true,
) {
    private val maxSpeedEnvCache = mutableMapOf<CachedBlock, Envelope>()
    private val mrspEnvCache = mutableMapOf<MrspCacheKey, CachedMrsp>()
    private val blockToStopMap = mutableMapOf<BlockId, MutableList<Offset<Block>>>()
    private val blockToMaxSpeedMap = mutableMapOf<MrspCacheKey, Double>()

    private data class MrspCacheKey(val block: BlockId, val step: Int)

    private data class CachedBlock(val block: BlockId, val endSpeed: Double?, val stepIndex: Int)

    private data class CachedMrsp(val mrsp: Envelope, val context: EnvelopeSimContext)

    init {
        for (stop in steps.filter { it.stop }) {
            val blockToLocationMap = mutableMapOf<BlockId, Offset<Block>>()
            for (location in stop.locations) {
                val currentOffset = blockToLocationMap.getOrPut(location.edge) { location.offset }
                if (location.offset < currentOffset)
                    blockToLocationMap[location.edge] = location.offset
            }
            blockToLocationMap.forEach { (block, stopOffset) ->
                blockToStopMap.getOrPut(block) { mutableListOf() }.add(stopOffset)
            }
        }
    }

    /** Returns the max speed envelope/mrsp for the given block (cached). */
    fun getMaxSpeedEnvelope(block: BlockId, step: Int, endSpeed: Double?): Envelope {
        val cacheKey = MrspCacheKey(block, step)
        if (endSpeed == null && blockToMaxSpeedMap.containsKey(cacheKey)) {
            // Return fastest block envelope by maximising its end speed.
            return maxSpeedEnvCache[CachedBlock(block, blockToMaxSpeedMap[cacheKey], step)]!!
        }
        val cachedMrsp =
            mrspEnvCache.computeIfAbsent(cacheKey) {
                // TODO: change input to infra explorers, and fetch last route there
                val pathProps =
                    buildTrainPathFromBlock(rawInfra, blockInfra, block, routes = listOf())
                val rollingStock = consistSchedule.rollingStocks[step]
                val context = build(rollingStock, pathProps, timeStep, comfort)
                val mrsp =
                    computeMRSP(
                        pathProps,
                        rollingStock.maxSpeed,
                        rollingStock.length,
                        addRollingStockLength = addRollingStockLength,
                        speedLimitTag,
                        temporarySpeedLimitManager,
                    )
                CachedMrsp(mrsp, context)
            }
        val actualEndSpeed = min(cachedMrsp.mrsp.endSpeed, endSpeed ?: Double.POSITIVE_INFINITY)
        blockToMaxSpeedMap.compute(cacheKey) { _, oldSpeed ->
            max(actualEndSpeed, oldSpeed ?: Double.NEGATIVE_INFINITY)
        }
        return maxSpeedEnvCache.computeIfAbsent(CachedBlock(block, actualEndSpeed, step)) {
            val stops =
                blockToStopMap[block]?.map {
                    SimStop(Offset(it.distance), RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP)
                } ?: listOf()
            val newMrsp =
                if (actualEndSpeed < cachedMrsp.mrsp.endSpeed)
                    addEndBrakingPart(cachedMrsp.context, actualEndSpeed, cachedMrsp.mrsp)
                else cachedMrsp.mrsp
            // TODO: Look into adding accelerations to the max speed envelope and benchmark it to
            // see if it improves the computing time.
            maxSpeedEnvelopeFrom(cachedMrsp.context, stops, newMrsp)
        }
    }

    /** Returns the time it takes to go through the given block, until `endOffset` if specified. */
    fun getBlockTime(
        block: BlockId,
        step: Int,
        endOffset: Offset<Block>?,
        endSpeed: Double?,
        allowanceValue: AllowanceValue? = null,
    ): Double {
        if (endOffset?.distance == 0.meters) return 0.0
        val actualLength = endOffset ?: blockInfra.getBlockLength(block)
        val time =
            getMaxSpeedEnvelope(block, step, endSpeed)
                .interpolateArrivalAtClamp(actualLength.meters)
        val allowanceTime = allowanceValue?.getAllowanceTime(time, actualLength.meters)
        return time + (allowanceTime ?: 0.0)
    }

    fun isStopAtStartOfBlock(block: BlockId): Boolean {
        return blockToStopMap[block]?.first() == Offset.zero<Block>()
    }
}
