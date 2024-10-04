package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.OffsetList
import java.math.BigInteger
import java.security.MessageDigest

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

    // Maps to/from block names, may be undefined (null) in some unit tests if names would conflict
    private var nameToBlockMap: MutableMap<String, BlockId> = mutableMapOf()
    private val blockToNameMap: Map<BlockId, String>

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

            // Build the block identifier maps
            val name = buildBlockName(rawInfra, blockId, blockPool)
            assert(!nameToBlockMap.containsKey(name)) { "duplicate in generated block ID ($name)" }
            nameToBlockMap[name] = blockId
        }
        blockToNameMap = nameToBlockMap.entries.associate { (k, v) -> v to k }
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

    override fun getBlockName(block: BlockId): String {
        return blockToNameMap[block]!!
    }

    override fun getBlockFromName(name: String): BlockId? {
        return nameToBlockMap[name]
    }
}

/**
 * Build the persistent unique string identifiers for a given block. The identifiers can follow any
 * format we want, but should be as stable as possible across versions and infra changes.
 */
private fun buildBlockName(
    rawInfra: RawInfra,
    block: BlockId,
    blockPool: StaticPool<Block, BlockDescriptor>
): String {
    // Two different blocks must differ in *either* detectors, signal / signaling system, or switch
    // config.
    // We must include all 3 in the ID to make sure there's no collision.
    // Detectors are encoded as "detectorId", the direction isn't necessary
    // Signals are encoded as "signalId-signalingSystem".
    // Switch configs are encoded as "nodeId-configName"
    // It is fairly heavyweight for an ID, but there's no way around it without making this ID
    // part of the railjson file format and stable during the import process.
    val descriptor = blockPool[block]
    val signals =
        descriptor.signals.map {
            "${rawInfra.getLogicalSignalName(it)}-${rawInfra.getSignalingSystemId(it)}"
        }
    val tracks = mutableListOf<String>()
    val trackIds = mutableListOf<DirTrackSectionId>()
    for (zonePath in descriptor.path) {
        for (chunk in rawInfra.getZonePathChunks(zonePath)) {
            val trackName = rawInfra.getTrackSectionName(rawInfra.getTrackFromChunk(chunk.value))
            if (tracks.isNotEmpty() && tracks[tracks.size - 1] == trackName) continue
            tracks.add(trackName)
            trackIds.add(
                DirTrackSectionId(rawInfra.getTrackFromChunk(chunk.value), chunk.direction)
            )
        }
    }
    val trackNodes = descriptor.path.flatMap { rawInfra.getZonePathMovableElements(it) }
    val trackNodeConfig = descriptor.path.flatMap { rawInfra.getZonePathMovableElementsConfigs(it) }
    val trackNodeConfigNames = mutableListOf<String>()
    for ((node, config) in trackNodes zip trackNodeConfig) {
        if (rawInfra.getTrackNodeConfigs(node).size == 1U) continue // Track link, can be skipped
        trackNodeConfigNames.add(
            "${rawInfra.getTrackNodeName(node)}-${rawInfra.getTrackNodeConfigName(node, config)}"
        )
    }

    val detectors = mutableListOf<DirDetectorId>()
    detectors.add(rawInfra.getZonePathEntry(descriptor.path[0]))
    detectors.add(rawInfra.getZonePathExit(descriptor.path.last()))
    val detectorStr = detectors.map { rawInfra.getDetectorName(it.value) }
    val rawStringId = "$signals;$detectorStr;$trackNodeConfigNames"

    // We need to hash the result, these strings are way too long for identifiers

    // Stackoverflow:
    // https://stackoverflow.com/questions/64171624/how-to-generate-an-md5-hash-in-kotlin
    fun md5(input: String): String {
        val md = MessageDigest.getInstance("MD5")
        return BigInteger(1, md.digest(input.toByteArray())).toString(16).padStart(32, '0')
    }
    return "block.${md5(rawStringId)}"
}
