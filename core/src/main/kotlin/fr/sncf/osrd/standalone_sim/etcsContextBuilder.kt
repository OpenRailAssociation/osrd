package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.utils.getNextTrackSections
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.mapToRangeSet
import fr.sncf.osrd.utils.units.Offset

/** Build the ETCS context, if relevant. */
fun makeETCSContext(
    rollingStock: RollingStock,
    infra: FullInfra,
    chunkPath: ChunkPath,
    routePath: StaticIdxList<Route>,
    signalingRanges: DistanceRangeMap<String>,
): EnvelopeSimContext.ETCSContext? {
    val etcsRanges = signalingRanges.mapToRangeSet { it == ETCS_LEVEL2.id }

    if (etcsRanges.asList().isEmpty()) {
        return null
    } else {
        assert(rollingStock.etcsBrakeParams != null) {
            "Invalid ETCS context: ETCS ranges on the path while no ETCS brake params provided on rolling-stock"
        }
    }
    return EnvelopeSimContext.ETCSContext(
        etcsRanges,
        buildETCSDangerPoints(infra.rawInfra, chunkPath, routePath)
    )
}

/**
 * Builds the list of ETCS "danger points" (switches and buffer stops). Goes up to the first one at
 * or after the end of the path. Does not return the point at offset 0 if any (wouldn't be useful).
 * May return any number of point beyond the end of the path, specifically any point covered by the
 * routes used by the path.
 */
fun buildETCSDangerPoints(
    infra: RawInfra,
    chunkPath: ChunkPath,
    routePath: StaticIdxList<Route>
): List<Offset<TravelledPath>> {
    val zonePaths = routePath.flatMap { infra.getRoutePath(it) }
    var currentZonePathStartOffset = -getRoutePathStartOffset(infra, chunkPath, zonePaths).distance

    val res = mutableSetOf<Offset<TravelledPath>>()
    for (zonePath in zonePaths) {
        val movableElements = infra.getZonePathMovableElements(zonePath)
        val movableElementPositions = infra.getZonePathMovableElementsPositions(zonePath)
        for ((element, position) in movableElements zip movableElementPositions) {
            if (infra.getTrackNodeConfigs(element).size <= 1U) continue
            res.add(Offset(position.distance + currentZonePathStartOffset))
        }
        currentZonePathStartOffset += infra.getZonePathLength(zonePath).distance
    }

    findLastDangerPoint(infra, chunkPath)?.let { res.add(it) }
    return res.sorted()
}

/**
 * Find the last danger point, which may extend beyond the end of the path. Null if tracks are
 * circular with no switch nor buffer stop.
 */
fun findLastDangerPoint(infra: RawInfra, chunkPath: ChunkPath): Offset<TravelledPath>? {
    // Find the offset of the last chunk on the path
    val lastChunk = chunkPath.chunks.last()
    var lastChunkEndOffset = Offset<TravelledPath>(chunkPath.beginOffset.distance * -1.0)
    for (chunk in chunkPath.chunks) {
        lastChunkEndOffset += infra.getTrackChunkLength(chunk.value).distance
    }
    val lastTrack = infra.getTrackFromChunk(lastChunk.value)
    val endOfLastTrackPathOffset =
        getEndOfLastTrackPathOffset(infra, lastTrack, lastChunk, lastChunkEndOffset)

    // Iterate on the tracks until finding either a switch or a buffer stop
    var currentTrackEndOffset = endOfLastTrackPathOffset
    var track = DirStaticIdx(lastTrack, lastChunk.direction)
    while (true) {
        val nextTracks = infra.getNextTrackSections(track)
        val endAtDangerPoint = nextTracks.size != 1
        if (endAtDangerPoint) {
            return currentTrackEndOffset
        }
        track = nextTracks.single()
        currentTrackEndOffset += infra.getTrackSectionLength(track.value).distance
        if (track.value == lastTrack) return null // Circular tracks
    }
}

/** Figure out where the end of the last track is located, as a path offset. */
fun getEndOfLastTrackPathOffset(
    infra: RawInfra,
    lastTrack: TrackSectionId,
    lastChunk: DirStaticIdx<TrackChunk>,
    lastChunkEndOffset: Offset<TravelledPath>
): Offset<TravelledPath> {
    val lastTrackLength = infra.getTrackSectionLength(lastTrack)
    val lastChunkLength = infra.getTrackChunkLength(lastChunk.value)

    // As an offset on the undirected last track, where the start of the (undirected) last chunk is
    // located
    val lastUndirectedChunkStartOffsetOnTrack = infra.getTrackChunkOffset(lastChunk.value)

    val distanceFromChunkEndToTrackEnd =
        if (lastChunk.direction == Direction.INCREASING)
            lastTrackLength.distance -
                (lastUndirectedChunkStartOffsetOnTrack.distance + lastChunkLength.distance)
        else lastUndirectedChunkStartOffsetOnTrack.distance

    return lastChunkEndOffset + distanceFromChunkEndToTrackEnd
}
