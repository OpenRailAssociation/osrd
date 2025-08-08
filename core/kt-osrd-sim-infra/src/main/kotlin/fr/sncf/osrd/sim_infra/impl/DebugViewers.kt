package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.recoverBlocks
import fr.sncf.osrd.sim_infra.utils.toBlockList
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

/**
 * These classes shouldn't be generally used, it's only here to make it easier to track objects when
 * using a debugger. They can be used to create watches containing the object properties.
 */
data class DirectedViewer<T>(val rawId: UInt, val direction: Direction, val value: T)

data class ChunkViewer(
    val trackName: String,
    val offset: Offset<TrackSection>,
    val length: Length<TrackChunk>,
    val id: TrackChunkId,
)

data class ZonePathViewer(
    val chunks: List<DirectedViewer<ChunkViewer>>,
    val id: ZonePathId,
    val length: Length<ZonePath>,
)

data class BlockViewer(
    val zones: List<ZonePathViewer>,
    val id: BlockId,
    val entry: DirectedViewer<String>,
    val exit: DirectedViewer<String>,
    val length: Length<Block>,
)

data class RouteViewer(val name: String, val blocks: List<BlockViewer>, val id: RouteId)

fun <T, U> makeDirViewer(id: DirStaticIdx<T>, value: U): DirectedViewer<U> {
    return DirectedViewer(id.data, id.direction, value)
}

fun makeChunk(infra: RawInfra, id: StaticIdx<TrackChunk>): ChunkViewer {
    return ChunkViewer(
        infra.getTrackSectionName(infra.getTrackFromChunk(id)),
        infra.getTrackChunkOffset(id),
        infra.getTrackChunkLength(id),
        id,
    )
}

fun makeDirChunk(infra: RawInfra, id: DirStaticIdx<TrackChunk>): DirectedViewer<ChunkViewer> {
    return makeDirViewer(id, makeChunk(infra, id.value))
}

fun makeZonePath(infra: RawInfra, id: StaticIdx<ZonePath>): ZonePathViewer {
    return ZonePathViewer(
        infra.getZonePathChunks(id).map { dirChunk ->
            makeDirViewer(dirChunk, makeChunk(infra, dirChunk.value))
        },
        id,
        infra.getZonePathLength(id),
    )
}

fun makeBlock(rawInfra: RawInfra, blockInfra: BlockInfra, id: StaticIdx<Block>): BlockViewer {
    val entry = rawInfra.getZonePathEntry(blockInfra.getBlockZonePaths(id)[0])
    val exit = rawInfra.getZonePathExit(blockInfra.getBlockZonePaths(id).last())
    return BlockViewer(
        blockInfra.getBlockZonePaths(id).map { path -> makeZonePath(rawInfra, path) },
        id,
        makeDirViewer(entry, rawInfra.getDetectorName(entry.value)),
        makeDirViewer(exit, rawInfra.getDetectorName(exit.value)),
        blockInfra.getBlockLength(id),
    )
}

fun makeRoute(rawInfra: RawInfra, blockInfra: BlockInfra, id: StaticIdx<Route>): RouteViewer {
    val ids = MutableStaticIdxArrayList<Route>()
    ids.add(id)
    return RouteViewer(
        rawInfra.getRouteName(id),
        recoverBlocks(rawInfra, blockInfra, ids, null)[0].toBlockList().map { block ->
            makeBlock(rawInfra, blockInfra, block)
        },
        id,
    )
}
