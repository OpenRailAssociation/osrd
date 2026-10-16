package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import java.util.HashSet

data class BlockLocation(val edge: BlockId, val offset: Offset<Block>)

data class TrackLocation(val trackId: TrackSectionId, val offset: Offset<TrackSection>)

@Suppress("INAPPLICABLE_JVM_NAME")
interface BlockInfra {
    val blocks: StaticIdxSpace<Block>

    fun getBlockZonePaths(block: BlockId): List<ZonePathId>

    fun getBlocksInZone(zone: ZoneId): List<BlockId>

    fun getBlockSignals(block: BlockId): List<LogicalSignalId>

    fun blockStartAtBufferStop(block: BlockId): Boolean

    fun blockStopAtBufferStop(block: BlockId): Boolean

    fun getBlockSignalingSystem(block: BlockId): SignalingSystemId

    fun getBlocksStartingAtDetector(detector: DirDetectorId): List<BlockId>

    fun getBlocksEndingAtDetector(detector: DirDetectorId): List<BlockId>

    fun getBlocksAtSignal(signal: LogicalSignalId): List<BlockId>

    fun getSignalsPositions(block: BlockId): OffsetList<Block>

    fun getBlocksFromTrackChunk(
        trackChunk: TrackChunkId,
        direction: Direction,
    ): MutableStaticIdxArraySet<Block>

    fun getTrackChunksFromBlock(block: BlockId): List<DirTrackChunkId>

    fun getBlockLength(block: BlockId): Length<Block>

    /** Returns a unique and stable string identifier for the given block. */
    fun getBlockName(block: BlockId): String

    /** Find the block with the given string identifier, or null if not found. */
    fun getBlockFromName(name: String): BlockId?
}

fun BlockInfra.getBlockOffset(
    blockId: BlockId,
    waypointDirChunkLocation: DirChunkLocation,
    rawInfra: RawInfra,
): Offset<Block> {
    var startBlockToStartChunk: Offset<Block> = Offset(0.meters)
    val blockTrackChunks = this.getTrackChunksFromBlock(blockId)
    for (blockTrackChunkDirId in blockTrackChunks) {
        if (blockTrackChunkDirId == waypointDirChunkLocation.dirChunk) {
            return startBlockToStartChunk + waypointDirChunkLocation.offset.distance
        }
        startBlockToStartChunk += rawInfra.getTrackChunkLength(blockTrackChunkDirId.value).distance
    }
    throw AssertionError(
        String.format(
            "getBlockOffset: Directed track chunk %s not in block %s",
            waypointDirChunkLocation.dirChunk,
            blockId,
        ),
    )
}

fun BlockInfra.getDirChunkLocation(
    blockLocation: BlockLocation,
    rawInfra: RawInfra,
): DirChunkLocation {
    val chunks = this.getTrackChunksFromBlock(blockLocation.edge)
    var offsetToStep = blockLocation.offset.distance
    chunks.forEach { chunk ->
        val chunkLength = rawInfra.getTrackChunkLength(chunk.value).distance
        if (offsetToStep > chunkLength) {
            offsetToStep -= chunkLength
            return@forEach
        }
        return DirChunkLocation(chunk, Offset(offsetToStep))
    }
    throw AssertionError(
        String.format(
            "getDirChunkLocation: Did not find chunk location for BlockLocation $blockLocation: wrong offset?",
        ),
    )
}

/** Returns the corresponding block locations of a track location. */
fun BlockInfra.findDirTrackLocationBlocks(
    rawInfra: RawInfra,
    trackLocation: TrackLocation,
    direction: Direction,
): Set<BlockLocation> {
    val chunkLocation = getChunkLocationFromTrackLocation(trackLocation, rawInfra)
    return findChunkLocationBlocks(rawInfra, chunkLocation, direction)
}

/** Returns the corresponding block locations of a chunk location. */
fun BlockInfra.findChunkLocationBlocks(
    rawInfra: RawInfra,
    chunkLocation: ChunkLocation,
    direction: Direction,
): Set<BlockLocation> {
    val chunkLength = rawInfra.getTrackChunkLength(chunkLocation.chunk)
    val directedChunkOffset = chunkLocation.offset.toDirected(chunkLength, direction)
    val waypointDirChunkLocation =
        DirChunkLocation(
            DirTrackChunkId(chunkLocation.chunk, direction),
            directedChunkOffset,
        )

    return findDirChunkLocationBlocks(rawInfra, waypointDirChunkLocation)
}

/** Returns the corresponding block locations of a directed chunk location. */
fun BlockInfra.findDirChunkLocationBlocks(
    rawInfra: RawInfra,
    waypointDirChunkLocation: DirChunkLocation,
): HashSet<BlockLocation> {
    val res = HashSet<BlockLocation>()
    val blocksOnWaypoint =
        getBlocksFromTrackChunk(
                waypointDirChunkLocation.dirChunk.value,
                waypointDirChunkLocation.dirChunk.direction,
            )
            .toSet()
    for (block in blocksOnWaypoint) {
        val offset = getBlockOffset(block, waypointDirChunkLocation, rawInfra)
        assert(offset <= getBlockLength(block))
        res.add(BlockLocation(block, offset))
    }
    return res
}

fun BlockInfra.findTrackLocationBlocks(
    rawInfra: RawInfra,
    waypoints: Collection<TrackLocation>,
): Set<BlockLocation> {
    val waypointBlocks = HashSet<BlockLocation>()
    for (waypoint in waypoints) {
        for (direction in Direction.entries) {
            waypointBlocks.addAll(findDirTrackLocationBlocks(rawInfra, waypoint, direction))
        }
    }
    return waypointBlocks
}

private fun getChunkLocationFromTrackLocation(
    trackLocation: TrackLocation,
    rawInfra: RawSignalingInfra,
): ChunkLocation {
    val trackSectionChunks = rawInfra.getTrackSectionChunks(trackLocation.trackId)
    for (chunk in trackSectionChunks) {
        val startChunk = rawInfra.getTrackChunkOffset(chunk)
        val endChunk = startChunk + rawInfra.getTrackChunkLength(chunk).distance
        if (trackLocation.offset in startChunk..endChunk)
            return ChunkLocation(chunk, Offset(trackLocation.offset - startChunk))
    }
    throw OSRDError(ErrorType.InvalidWaypointLocation)
        .withContext("track", rawInfra.getTrackSectionName(trackLocation.trackId))
        .withContext("offset", trackLocation.offset)
}

/**
 * Given a waypoint block (initial position of a train stop), returns the new stop position of a
 * train: end of current block, with the constraints of staying in the same block and keeping the
 * tail of the train on the initial position (waypointBlock). Note that nodes of the infra are not
 * considered.
 */
fun BlockInfra.findStopPositionAtEndOfBlockConsideringRollingStock(
    waypointBlock: BlockLocation,
    destinationBlock: Set<BlockLocation>,
    rollingStockLength: Double,
): BlockLocation {
    // To ensure that the tail of the rolling stock is not further than the initial operational
    // point (waypointBlock) position
    val maxTailOffset = waypointBlock.offset + rollingStockLength.meters

    // Can't go further than the end of the block, which is delimited by a block-delimiting signal
    val maxHeadOffset = getBlockLength(waypointBlock.edge)

    val newWaypointOffset = Offset.min(maxTailOffset, maxHeadOffset)

    val destinationOffset =
        destinationBlock
            .filter { it.edge == waypointBlock.edge && waypointBlock.offset <= it.offset }
            .minOfOrNull { it.offset }

    // The waypoint offset does not change in the case where the stop is after the destination
    if (destinationOffset != null && destinationOffset <= newWaypointOffset)
        return BlockLocation(waypointBlock.edge, waypointBlock.offset)

    return BlockLocation(waypointBlock.edge, newWaypointOffset)
}
