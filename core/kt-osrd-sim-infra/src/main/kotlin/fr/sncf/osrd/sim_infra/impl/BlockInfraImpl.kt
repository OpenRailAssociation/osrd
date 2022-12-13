package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*

data class BlockDescriptor(
    val startAtBufferStop: Boolean,
    val stopsAtBufferStop: Boolean,
    val path: StaticIdxList<ZonePath>,
    val signals: StaticIdxList<LogicalSignal>,
)

class BlockInfraImpl(
    private val blockPool: StaticPool<Block, BlockDescriptor>,
    private val loadedSignalInfra: LoadedSignalInfra,
    rawInfra: RawInfra,
) : BlockInfra {
    private val blockEntryMap = IdxMap<DirDetectorId, MutableStaticIdxList<Block>>()

    init {
        for (blockId in blockPool.space()) {
            val entryZonePath = blockPool[blockId].path[0]
            val entryDirDet = rawInfra.getZonePathEntry(entryZonePath)
            val list = blockEntryMap.getOrPut(entryDirDet) { mutableStaticIdxArrayListOf() }
            list.add(blockId)
        }
    }

    override val blocks: StaticIdxSpace<Block>
        get() = blockPool.space()

    override fun getBlockPath(block: BlockId): StaticIdxList<ZonePath> {
        return blockPool[block].path
    }

    override fun getBlockSignals(block: BlockId): StaticIdxList<LogicalSignal> {
        return blockPool[block].signals
    }

    override fun blockStartAtBufferStop(block: BlockId): Boolean {
        return blockPool[block].startAtBufferStop
    }

    override fun blockStopAtBufferStop(block: BlockId): Boolean {
        return blockPool[block].stopsAtBufferStop
    }

    override fun getBlockSignalingSystem(block: BlockId): SignalingSystemId {
        return loadedSignalInfra.getSignalingSystem(blockPool[block].signals[0])
    }

    override fun getBlocksAt(detector: DirDetectorId): StaticIdxList<Block> {
        return blockEntryMap[detector] ?: mutableStaticIdxArrayListOf()
    }
}
