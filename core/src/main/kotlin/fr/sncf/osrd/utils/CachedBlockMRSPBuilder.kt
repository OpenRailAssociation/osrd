package fr.sncf.osrd.utils

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * Used to compute block MRSPs and min time required to reach a point, with proper caching
 *
 * TODO: this ignores speed limits by route for now. It makes caching a lot less efficient though
 *   (can't just use block as key), it will have a significant performance cost. Should be supported
 *   once we import them, but not necessarily before that.
 */
data class CachedBlockMRSPBuilder(
    val rawInfra: RawInfra,
    val blockInfra: BlockInfra,
    private val rsMaxSpeed: Double,
    private val rsLength: Double,
    private val speedLimitTag: String? = null,
    val temporarySpeedLimitManager: TemporarySpeedLimitManager = TemporarySpeedLimitManager(),
    val addRollingStockLength: Boolean = true,
) {
    private val mrspCache = mutableMapOf<BlockId, Envelope>()

    constructor(
        rawInfra: RawInfra,
        blockInfra: BlockInfra,
        rollingStock: PhysicsRollingStock?,
        speedLimitTag: String? = null,
        temporarySpeedLimitManager: TemporarySpeedLimitManager = TemporarySpeedLimitManager(),
        addRollingStockLength: Boolean = true,
    ) : this(
        rawInfra,
        blockInfra,
        rollingStock?.maxSpeed ?: DEFAULT_MAX_ROLLING_STOCK_SPEED,
        rollingStock?.length ?: 0.0,
        speedLimitTag,
        temporarySpeedLimitManager,
        addRollingStockLength,
    )

    /** Returns the speed limits for the given block (cached). */
    fun getMRSP(block: BlockId): Envelope {
        return mrspCache.computeIfAbsent(block) {
            // TODO: change input to infra explorers, and fetch last route there
            val pathProps = buildTrainPathFromBlock(rawInfra, blockInfra, block, routes = listOf())
            computeMRSP(
                pathProps,
                rsMaxSpeed,
                rsLength,
                addRollingStockLength = addRollingStockLength,
                speedLimitTag,
                temporarySpeedLimitManager,
            )
        }
    }

    /** Returns the time it takes to go through the given block, until `endOffset` if specified. */
    fun getBlockTime(
        block: BlockId,
        endOffset: Offset<Block>?,
        allowanceValue: AllowanceValue? = null,
    ): Double {
        if (endOffset?.distance == 0.meters) return 0.0
        val actualLength = endOffset ?: blockInfra.getBlockLength(block)
        val mrsp = getMRSP(block)
        val time = mrsp.interpolateArrivalAtClamp(actualLength.meters)
        val allowanceTime = allowanceValue?.getAllowanceTime(time, actualLength.meters)
        return time + (allowanceTime ?: 0.0)
    }

    companion object {
        // 320km/h as default value (global max speed in France)
        const val DEFAULT_MAX_ROLLING_STOCK_SPEED = (320.0 / 3.6)
    }
}
