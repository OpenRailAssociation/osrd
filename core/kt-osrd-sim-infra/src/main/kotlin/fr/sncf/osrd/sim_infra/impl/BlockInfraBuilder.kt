package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*

interface BlockInfraBuilder {
    fun block(
        startAtBufferStop: Boolean,
        stopsAtBufferStop: Boolean,
        path: List<ZonePathId>,
        signals: List<LogicalSignalId>,
        signalsDistances: OffsetList<Block>,
    ): BlockId
}

class BlockInfraBuilderImpl(val loadedSignalInfra: LoadedSignalInfra, val rawInfra: RawInfra) :
    BlockInfraBuilder {
    private val blockSet = mutableMapOf<BlockDescriptor, BlockId>()
    private val blockPool = StaticPool<Block, BlockDescriptor>()

    override fun block(
        startAtBufferStop: Boolean,
        stopsAtBufferStop: Boolean,
        path: List<ZonePathId>,
        signals: List<LogicalSignalId>,
        signalsDistances: OffsetList<Block>,
    ): BlockId {
        if (path.size == 0) {
            val error = OSRDError(ErrorType.DelimitingSignalEmptyBlock)
            error.context["signals"] = signals.map { rawInfra.getLogicalSignalName(it) }
            error.context["signalingSystems"] = signals.map { rawInfra.getSignalingSystemId(it) }
            error.context["startAtBufferStop"] = startAtBufferStop
            error.context["stopsAtBufferStop"] = stopsAtBufferStop
            error.context["signalsDistances"] = signalsDistances
            throw error
        }

        var length = Length<Block>(0.meters)
        for (zonePath in path) length += rawInfra.getZonePathLength(zonePath).distance

        val newBlock =
            BlockDescriptor(
                length,
                startAtBufferStop,
                stopsAtBufferStop,
                path,
                signals,
                signalsDistances,
            )
        return blockSet.getOrPut(newBlock) { blockPool.add(newBlock) }
    }

    fun build(): BlockInfra {
        return BlockInfraImpl(blockPool, loadedSignalInfra, rawInfra)
    }
}

fun blockInfraBuilder(
    loadedSignalInfra: LoadedSignalInfra,
    rawInfra: RawInfra,
    init: BlockInfraBuilder.() -> Unit,
): BlockInfra {
    val builder = BlockInfraBuilderImpl(loadedSignalInfra, rawInfra)
    builder.init()
    return builder.build()
}
