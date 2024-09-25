package fr.sncf.osrd.utils

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** Used to compute block MRSPs and min time required to reach a point, with proper caching */
data class CachedBlockMRSPBuilder(
    val rawInfra: RawInfra,
    val blockInfra: BlockInfra,
    private val rsMaxSpeed: Double,
    private val rsLength: Double,
) {
    private val mrspCache = mutableMapOf<BlockId, Envelope>()

    constructor(
        rawInfra: RawInfra,
        blockInfra: BlockInfra,
        rollingStock: PhysicsRollingStock?
    ) : this(
        rawInfra,
        blockInfra,
        rollingStock?.maxSpeed ?: DEFAULT_MAX_ROLLING_STOCK_SPEED,
        rollingStock?.length ?: 0.0
    )

    /** Returns the speed limits for the given block (cached). */
    fun getMRSP(block: BlockId): Envelope {
        return mrspCache.computeIfAbsent(block) {
            val pathProps = makePathProps(blockInfra, rawInfra, block, routes = listOf())
            computeMRSP(pathProps, rsMaxSpeed, rsLength, false, null)
        }
    }

    /** Returns the time it takes to go through the given block, until `endOffset` if specified. */
    fun getBlockTime(
        block: BlockId,
        endOffset: Offset<Block>?,
    ): Double {
        if (endOffset?.distance == 0.meters) return 0.0
        val actualLength = endOffset ?: blockInfra.getBlockLength(block)
        val mrsp = getMRSP(block)
        return mrsp.interpolateArrivalAtClamp(actualLength.distance.meters)
    }

    companion object {
        // 320km/h as default value (global max speed in France)
        const val DEFAULT_MAX_ROLLING_STOCK_SPEED = (320.0 / 3.6)
    }
}
