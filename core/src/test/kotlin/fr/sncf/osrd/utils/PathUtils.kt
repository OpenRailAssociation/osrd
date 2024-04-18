package fr.sncf.osrd.utils

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** Build a path from track ids */
fun pathFromTracks(
    infra: RawInfra,
    trackIds: List<String>,
    dir: Direction,
    start: Distance,
    end: Distance
): PathProperties {
    val chunkList = mutableDirStaticIdxArrayListOf<TrackChunk>()
    trackIds
        .map { id -> infra.getTrackSectionFromName(id)!! }
        .flatMap { track -> infra.getTrackSectionChunks(track).dirIter(dir) }
        .forEach { dirChunk -> chunkList.add(dirChunk) }
    return buildPathPropertiesFrom(infra, chunkList, Length(start), Length(end))
}

/** Build a path from route ids */
fun pathFromRoutes(
    infra: RawInfra,
    routes: List<RouteId>,
): ChunkPath {
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    var length = Length<Path>(0.meters)
    for (route in routes) {
        for (chunk in infra.getChunksOnRoute(route)) {
            chunks.add(chunk)
            length += infra.getTrackChunkLength(chunk.value).distance
        }
    }
    return buildChunkPath(infra, chunks, Offset(0.meters), length)
}
