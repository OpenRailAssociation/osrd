package fr.sncf.osrd.utils

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.path.implementations.buildChunkPath
import fr.sncf.osrd.path.implementations.buildTrainPathFromChunkPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

/** Build a path from track ids */
fun pathFromTracks(
    infra: RawInfra,
    blockInfra: BlockInfra,
    trackIds: List<String>,
    dir: Direction,
    start: Distance,
    end: Distance,
    electricalProfileMapping: ElectricalProfileMapping? = null,
    routeNames: List<String>? = null,
): TrainPath {
    val chunkList = mutableDirStaticIdxArrayListOf<TrackChunk>()
    trackIds
        .map { id -> infra.getTrackSectionFromName(id)!! }
        .flatMap { track -> infra.getTrackSectionChunks(track).dirIter(dir) }
        .forEach { dirChunk -> chunkList.add(dirChunk) }
    val chunkPath = buildChunkPath(infra, chunkList, Offset(start), Offset(end))
    return buildTrainPathFromChunkPath(
        infra,
        blockInfra,
        chunkPath,
        electricalProfileMapping = electricalProfileMapping,
        routeNames = routeNames,
    )
}

fun pathFromTracks(
    infra: FullInfra,
    trackIds: List<String>,
    dir: Direction,
    start: Distance,
    end: Distance,
    electricalProfileMapping: ElectricalProfileMapping? = null,
    routeNames: List<String>? = null,
): TrainPath {
    return pathFromTracks(
        infra.rawInfra,
        infra.blockInfra,
        trackIds,
        dir,
        start,
        end,
        electricalProfileMapping = electricalProfileMapping,
        routeNames = routeNames,
    )
}
