package fr.sncf.osrd.utils

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
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
import kotlin.collections.first

/**
 * Used to compute block MaxSpeedEnvelopes and min time required to reach a point, with proper
 * caching.
 *
 * TODO: this ignores speed limits by route for now. It makes caching a lot less efficient though
 *   (can't just use block as key), it will have a significant performance cost. Should be supported
 *   once we import them, but not necessarily before that.
 */
data class CachedBlockMaxSpeedEnvBuilder(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,
    private val rollingStock: PhysicsRollingStock,
    private val steps: List<ExplorerStep>,
    private val timeStep: Double,
    private val comfort: Comfort? = null,
    private val speedLimitTag: String? = null,
    private val temporarySpeedLimitManager: TemporarySpeedLimitManager =
        TemporarySpeedLimitManager(),
    private val addRollingStockLength: Boolean = true,
) {
    private val maxSpeedEnvCache = mutableMapOf<BlockId, Envelope>()
    private val blockToStopMap = mutableMapOf<BlockId, MutableList<Offset<Block>>>()

    init {
        for (stop in steps.filter { it.stop }) {
            val blockToLocationMap = mutableMapOf<BlockId, Offset<Block>>()
            for (location in stop.locations) {
                val currentOffset = blockToLocationMap.getOrPut(location.edge) { location.offset }
                if (location.offset < currentOffset)
                    blockToLocationMap[location.edge] = location.offset
            }
            blockToLocationMap.forEach { (block, stopOffset) ->
                blockToStopMap.getOrPut(block) { mutableListOf<Offset<Block>>() }.add(stopOffset)
            }
        }
    }

    /** Returns the max speed envelope/mrsp for the given block (cached). */
    fun getMaxSpeedEnvelope(block: BlockId, endSpeed: Double? = null): Envelope {
        return maxSpeedEnvCache.computeIfAbsent(block) {
            // TODO: change input to infra explorers, and fetch last route there
            val pathProps = buildTrainPathFromBlock(rawInfra, blockInfra, block, routes = listOf())
            val mrsp =
                computeMRSP(
                    pathProps,
                    rollingStock.maxSpeed,
                    rollingStock.length,
                    addRollingStockLength = addRollingStockLength,
                    speedLimitTag,
                    temporarySpeedLimitManager,
                )
            val context = build(rollingStock, pathProps, timeStep, comfort)
            val stops =
                blockToStopMap[block]?.map {
                    SimStop(Offset(it.distance), RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP)
                } ?: listOf()
            val newMrsp =
                if (endSpeed != null && endSpeed < mrsp.endSpeed)
                    addEndBrakingPart(context, endSpeed, mrsp)
                else mrsp
            maxSpeedEnvelopeFrom(context, stops, newMrsp)
        }
    }

    /** Returns the time it takes to go through the given block, until `endOffset` if specified. */
    fun getBlockTime(
        block: BlockId,
        endOffset: Offset<Block>?,
        allowanceValue: AllowanceValue? = null,
        endSpeed: Double? = null,
    ): Double {
        if (endOffset?.distance == 0.meters) return 0.0
        val actualLength = endOffset ?: blockInfra.getBlockLength(block)
        val maxSpeedEnvelope = getMaxSpeedEnvelope(block, endSpeed)
        val time = maxSpeedEnvelope.interpolateArrivalAtClamp(actualLength.meters)
        val allowanceTime = allowanceValue?.getAllowanceTime(time, actualLength.meters)
        return time + (allowanceTime ?: 0.0)
    }

    fun isStopAtStartOfBlock(block: BlockId): Boolean {
        return blockToStopMap[block]?.first() == Offset.zero<Block>()
    }
}
