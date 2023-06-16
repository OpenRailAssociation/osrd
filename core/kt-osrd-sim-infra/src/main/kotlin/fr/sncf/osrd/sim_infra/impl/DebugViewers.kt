package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Distance

/** These classes shouldn't be generally used, it's only here to make it easier to track objects
 * when using a debugger. They can be used to create watches containing the object properties. */

data class DirectedViewer<T>(
    val direction: Direction,
    val value: T,
)

data class ChunkViewer(
    val trackName: String,
    val offset: Distance,
    val length: Distance,
    val id: TrackChunkId,
)

data class ZonePathViewer(
    val chunks: List<DirectedViewer<ChunkViewer>>,
    val id: ZonePathId,
)

data class BlockViewer(
    val zones: List<ZonePathViewer>,
    val id: BlockId,
)

data class RouteViewer(
    val name: String,
    val blocks: List<BlockViewer>,
    val id: RouteId,
)

@JvmName("makeChunk")
fun makeChunk(infra: RawInfra, id: StaticIdx<TrackChunk>): ChunkViewer {
    return ChunkViewer(
        infra.getTrackSectionName(infra.getTrackFromChunk(id)),
        infra.getTrackChunkOffset(id),
        infra.getTrackChunkLength(id),
        id,
    )
}

@JvmName("makeZonePath")
fun makeZonePath(infra: RawInfra, id: StaticIdx<ZonePath>): ZonePathViewer {
    return ZonePathViewer(
        infra.getZonePathChunks(id)
            .map { dirChunk -> DirectedViewer(dirChunk.direction, makeChunk(infra, dirChunk.value)) },
        id,
    )
}

@JvmName("makeBlock")
fun makeBlock(rawInfra: RawInfra, blockInfra: BlockInfra, id: StaticIdx<Block>): BlockViewer {
    return BlockViewer(
        blockInfra.getBlockPath(id)
            .map { path -> makeZonePath(rawInfra, path) },
        id,
    )
}

@JvmName("makeRoute")
fun makeRoute(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    signalingSystems: StaticIdxList<SignalingSystem>,
    id: StaticIdx<Route>,
): RouteViewer {
    val ids = MutableStaticIdxArrayList<Route>()
    ids.add(id)
    return RouteViewer(
        rawInfra.getRouteName(id)!!,
        getRouteBlocks(rawInfra, blockInfra, ids, signalingSystems)
            .flatten()
            .map { block -> makeBlock(rawInfra, blockInfra, block) },
        id,
    )
}
