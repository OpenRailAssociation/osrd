package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.path.interfaces.DirChunkRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.path.interfaces.getBlockAbsolutePathEnd
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.getNextTrackSections
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

/** Build the ETCS context, if relevant. */
fun makeETCSContext(
    rollingStock: RollingStock,
    infra: FullInfra,
    trainPath: TrainPath,
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
        buildETCSDangerPoints(infra.rawInfra, trainPath),
        buildETCSBlockDetectors(infra, trainPath),
    )
}

/**
 * Builds the list of ETCS "danger points" (switches and buffer stops). Goes up to the first one at
 * or after the end of the path. Does not return the point at offset 0 if any (wouldn't be useful).
 * May return any number of point beyond the end of the path, specifically any point covered by the
 * routes used by the path.
 */
fun buildETCSDangerPoints(infra: RawInfra, trainPath: TrainPath): List<Offset<TravelledPath>> {
    val res = mutableSetOf<Offset<TravelledPath>>()
    for (zonePathRange in trainPath.getZonePaths()) {
        val zonePath = zonePathRange.value
        val movableElements = infra.getZonePathMovableElements(zonePath)
        val movableElementPositions = infra.getZonePathMovableElementsPositions(zonePath)
        for ((element, position) in movableElements zip movableElementPositions) {
            if (infra.getTrackNodeConfigs(element).size <= 1U) continue
            res.add(zonePathRange.offsetToTrainPath(position))
        }
    }

    findLastDangerPoint(infra, trainPath)?.let { res.add(it) }
    return res.sorted()
}

/** Builds the offset list of detectors for ETCS blocks on the block path. */
fun buildETCSBlockDetectors(infra: FullInfra, trainPath: TrainPath): List<Offset<TrainPath>> {
    val etcsBlockDetectors = mutableListOf<Offset<TrainPath>>()
    for (blockRange in trainPath.getBlocks()) {
        val block = blockRange.value
        if (isETCSBlock(block, infra)) {
            // Add entry and exit detectors
            etcsBlockDetectors.add(blockRange.getObjectAbsolutePathStart())
            etcsBlockDetectors.add(blockRange.getBlockAbsolutePathEnd(infra.blockInfra))
        }
    }
    return etcsBlockDetectors.filter { it.distance >= Distance.ZERO }
}

private fun isETCSBlock(block: BlockId, infra: FullInfra): Boolean {
    return infra.signalingSimulator.sigModuleManager.getName(
        infra.blockInfra.getBlockSignalingSystem(block)
    ) == ETCS_LEVEL2.id
}

/**
 * Find the last danger point, which may extend beyond the end of the path. Null if tracks are
 * circular with no switch nor buffer stop.
 */
private fun findLastDangerPoint(infra: RawInfra, trainPath: TrainPath): Offset<TravelledPath>? {
    // Find the offset of the last chunk on the path
    val chunkRanges = trainPath.getChunks()
    val lastChunkRange = chunkRanges.last()
    val dirLastChunk = lastChunkRange.value
    val lastChunk = dirLastChunk.value
    val lastTrack = infra.getTrackFromChunk(lastChunk)
    val endOfLastTrackPathOffset = getEndOfLastTrackPathOffset(infra, lastTrack, lastChunkRange)

    // Iterate on the tracks until finding either a switch or a buffer stop
    var currentTrackEndOffset = endOfLastTrackPathOffset
    var track = DirStaticIdx(lastTrack, dirLastChunk.direction)
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
private fun getEndOfLastTrackPathOffset(
    infra: RawInfra,
    lastTrack: TrackSectionId,
    lastChunkRange: DirChunkRange,
): Offset<TravelledPath> {
    // Note: this function alone doesn't quite justify it,
    // but we could add a List<DirTrackRange> to TrainPath instead
    val dirLastChunk = lastChunkRange.value
    val lastChunk = dirLastChunk.value
    val lastTrackLength = infra.getTrackSectionLength(lastTrack)
    val lastChunkLength = infra.getTrackChunkLength(lastChunkRange.value.value)
    val lastChunkEndOffset = lastChunkRange.getObjectAbsolutePathEnd(lastChunkLength)

    // As an offset on the undirected last track, where the start of the (undirected) last chunk is
    // located
    val lastUndirectedChunkStartOffsetOnTrack = infra.getTrackChunkOffset(lastChunk)

    val distanceFromChunkEndToTrackEnd =
        if (dirLastChunk.direction == Direction.INCREASING)
            lastTrackLength.distance -
                (lastUndirectedChunkStartOffsetOnTrack.distance + lastChunkLength.distance)
        else lastUndirectedChunkStartOffsetOnTrack.distance

    return lastChunkEndOffset + distanceFromChunkEndToTrackEnd
}
