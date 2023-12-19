package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.OffsetList

class BlockDescriptor(
    val length: Length<Block>,
    val startAtBufferStop: Boolean,
    val stopsAtBufferStop: Boolean,
    val path: StaticIdxList<ZonePath>,
    val signals: StaticIdxList<LogicalSignal>,
    val signalsPositions: OffsetList<Block>,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as BlockDescriptor
        if (startAtBufferStop != other.startAtBufferStop) return false
        if (stopsAtBufferStop != other.stopsAtBufferStop) return false
        if (path != other.path) return false
        if (signals != other.signals) return false
        return true
    }

    override fun hashCode(): Int {
        var result = startAtBufferStop.hashCode()
        result = 31 * result + stopsAtBufferStop.hashCode()
        result = 31 * result + path.hashCode()
        result = 31 * result + signals.hashCode()
        return result
    }
}

class BlockInfraImpl(
    private val blockPool: StaticPool<Block, BlockDescriptor>,
    private val loadedSignalInfra: LoadedSignalInfra,
    rawInfra: RawInfra,
) : BlockInfra {
    private val blockEntryDetectorMap = IdxMap<DirDetectorId, MutableStaticIdxList<Block>>()
    private val blockExitDetectorMap = IdxMap<DirDetectorId, MutableStaticIdxList<Block>>()
    private val blockEntrySignalMap = IdxMap<LogicalSignalId, MutableStaticIdxList<Block>>()
    private val trackChunkToBlockMap =
        IdxMap<DirStaticIdx<TrackChunk>, MutableStaticIdxArraySet<Block>>()
    private val blockToTrackChunkMap =
        IdxMap<StaticIdx<Block>, MutableDirStaticIdxList<TrackChunk>>()
    private val zoneToBlockMap = IdxMap<ZoneId, MutableStaticIdxList<Block>>()

    init {
        for (blockId in blockPool.space()) {
            val block = blockPool[blockId]
            val entryZonePath = block.path[0]
            val exitZonePath = block.path[block.path.size - 1]

            // Update blockEntryDetectorMap
            val entryDirDet = rawInfra.getZonePathEntry(entryZonePath)
            val exitDirDet = rawInfra.getZonePathExit(exitZonePath)
            val entryDetList =
                blockEntryDetectorMap.getOrPut(entryDirDet) { mutableStaticIdxArrayListOf() }
            val exitDetList =
                blockExitDetectorMap.getOrPut(exitDirDet) { mutableStaticIdxArrayListOf() }
            entryDetList.add(blockId)
            exitDetList.add(blockId)

            // Update blockEntrySignalMap
            if (!block.startAtBufferStop) {
                val entrySig = block.signals[0]
                val sigList =
                    blockEntrySignalMap.getOrPut(entrySig) { mutableStaticIdxArrayListOf() }
                sigList.add(blockId)
            }

            // Update trackChunkToBlockMap, blockToTrackChunkMap, and zoneToBlockMap
            for (zonePath in getBlockPath(blockId)) {
                val trackChunks = rawInfra.getZonePathChunks(zonePath)
                val blockTrackChunks =
                    blockToTrackChunkMap.getOrPut(blockId) { mutableDirStaticIdxArrayListOf() }
                blockTrackChunks.addAll(trackChunks)
                for (trackChunk in trackChunks) {
                    val chunkBlocks =
                        trackChunkToBlockMap.getOrPut(trackChunk) { mutableStaticIdxArraySetOf() }
                    chunkBlocks.add(blockId)
                }
                zoneToBlockMap
                    .getOrPut(rawInfra.getZonePathZone(zonePath)) { mutableStaticIdxArrayListOf() }
                    .add(blockId)
            }
        }
    }

    override val blocks: StaticIdxSpace<Block>
        get() = blockPool.space()

    override fun getBlockPath(block: BlockId): StaticIdxList<ZonePath> {
        return blockPool[block].path
    }

    override fun getBlocksInZone(zone: ZoneId): StaticIdxList<Block> {
        return zoneToBlockMap[zone]!!
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

    override fun getBlocksStartingAtDetector(detector: DirDetectorId): StaticIdxList<Block> {
        return blockEntryDetectorMap[detector] ?: mutableStaticIdxArrayListOf()
    }

    override fun getBlocksEndingAtDetector(detector: DirDetectorId): StaticIdxList<Block> {
        return blockExitDetectorMap[detector] ?: mutableStaticIdxArrayListOf()
    }

    override fun getBlocksAtSignal(signal: LogicalSignalId): StaticIdxList<Block> {
        return blockEntrySignalMap[signal] ?: mutableStaticIdxArrayListOf()
    }

    override fun getSignalsPositions(block: BlockId): OffsetList<Block> {
        return blockPool[block].signalsPositions
    }

    override fun getBlocksFromTrackChunk(
        trackChunk: TrackChunkId,
        direction: Direction
    ): MutableStaticIdxArraySet<Block> {
        return trackChunkToBlockMap[DirStaticIdx(trackChunk, direction)]
            ?: mutableStaticIdxArraySetOf()
    }

    override fun getTrackChunksFromBlock(block: BlockId): DirStaticIdxList<TrackChunk> {
        return blockToTrackChunkMap[block] ?: mutableDirStaticIdxArrayListOf()
    }

    override fun getBlockLength(block: BlockId): Length<Block> {
        return blockPool[block].length
    }
}
