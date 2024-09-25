package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.kilometersPerHour
import fr.sncf.osrd.utils.units.meters

/**
 * Compute safety speed ranges, areas where the train has a lower speed limit because of a scheduled
 * stop. For details, see https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields
 * (or google "VISA (VItesse Sécuritaire d'Approche)" for resources in French)
 */
fun makeSafetySpeedRanges(
    infra: FullInfra,
    chunkPath: ChunkPath,
    routes: StaticIdxList<Route>,
    schedule: List<SimulationScheduleItem>
): DistanceRangeMap<Speed> {
    val rawInfra = infra.rawInfra
    val zonePaths = routes.flatMap { rawInfra.getRoutePath(it) }
    val zonePathStartOffset = getRoutePathStartOffset(rawInfra, chunkPath, zonePaths)
    val signalOffsets = getSignalOffsets(infra, zonePaths, zonePathStartOffset)

    val stopsWithSafetySpeed = schedule.filter { it.receptionSignal.isStopOnClosedSignal }

    val res = distanceRangeMapOf<Speed>()
    for (stop in stopsWithSafetySpeed) {
        // Currently, safety speed is applied to the next signal no matter the sight distance
        val nextSignalOffset =
            signalOffsets.firstOrNull { it >= stop.pathOffset }?.distance ?: chunkPath.length
        res.put(
            lower = nextSignalOffset - 200.meters,
            upper = nextSignalOffset,
            value = 30.kilometersPerHour,
        )
        if (stop.receptionSignal == RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP) {
            res.put(
                lower = nextSignalOffset - 100.meters,
                upper = nextSignalOffset,
                value = 10.kilometersPerHour,
            )
        }
    }
    // Safety speed areas may extend outside the path
    return res.subMap(0.meters, chunkPath.length)
}

/** Return the offsets of block-delimiting signals on the path. */
fun getSignalOffsets(
    infra: FullInfra,
    zonePaths: List<StaticIdx<ZonePath>>,
    pathStartOffset: Offset<Path>,
): List<Offset<TravelledPath>> {
    val res = mutableListOf<Offset<TravelledPath>>()
    val rawInfra = infra.rawInfra
    val signalingInfra = infra.loadedSignalInfra
    var prevZonePathsLength = 0.meters
    for (zonePath in zonePaths) {
        val signalPositions = rawInfra.getSignalPositions(zonePath)
        val signals = rawInfra.getSignals(zonePath)
        for ((signal, signalPosition) in signals zip signalPositions) {
            val isDelimiter =
                signalingInfra.getLogicalSignals(signal).any { signalingInfra.isBlockDelimiter(it) }
            if (isDelimiter) {
                res.add(
                    Offset(prevZonePathsLength + signalPosition.distance - pathStartOffset.distance)
                )
            }
        }
        prevZonePathsLength += rawInfra.getZonePathLength(zonePath).distance
    }
    return res.filter { it.distance >= 0.meters }
}

/** Returns the offset where the train actually starts, compared to the start of the first route. */
fun getRoutePathStartOffset(
    infra: RawInfra,
    chunkPath: ChunkPath,
    zonePaths: List<ZonePathId>
): Offset<Path> {
    var prevChunksLength = Offset<Path>(0.meters)
    val routeChunks = zonePaths.flatMap { infra.getZonePathChunks(it) }
    for (chunk in routeChunks) {
        if (chunk == chunkPath.chunks.first()) {
            return prevChunksLength + chunkPath.beginOffset.distance
        }
        prevChunksLength += infra.getTrackChunkLength(chunk.value).distance
    }
    throw RuntimeException("Unreachable (couldn't find first chunk in route list)")
}
