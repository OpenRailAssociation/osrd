package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*


interface BlockInfraBuilder {
    fun block(
        startAtBufferStop: Boolean,
        stopsAtBufferStop: Boolean,
        path: StaticIdxList<ZonePath>,
        signals: StaticIdxList<LogicalSignal>,
        signalsDistances: DistanceList,
    ): BlockId
}


class BlockInfraBuilderImpl : BlockInfraBuilder {
    private val blockSet = mutableMapOf<BlockDescriptor, BlockId>()
    private val blockPool = StaticPool<Block, BlockDescriptor>()
    override fun block(
        startAtBufferStop: Boolean,
        stopsAtBufferStop: Boolean,
        path: StaticIdxList<ZonePath>,
        signals: StaticIdxList<LogicalSignal>,
        signalsDistances: DistanceList,
    ): BlockId {
        assert(path.size != 0)
        val newBlock = BlockDescriptor(startAtBufferStop, stopsAtBufferStop, path, signals, signalsDistances)
        return blockSet.getOrPut(newBlock) { blockPool.add(newBlock) }
    }

    fun build(loadedSignalInfra: LoadedSignalInfra, rawInfra: RawInfra): BlockInfra {
        return BlockInfraImpl(blockPool, loadedSignalInfra, rawInfra)
    }
}


fun blockInfraBuilder(
    loadedSignalInfra: LoadedSignalInfra,
    rawInfra: RawInfra,
    init: BlockInfraBuilder.() -> Unit,
): BlockInfra {
    val builder = BlockInfraBuilderImpl()
    builder.init()
    return builder.build(loadedSignalInfra, rawInfra)
}
