@file:JvmName("ScheduleMetadataExtractor")

package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopePhysics
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.BlockPathElement
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter
import fr.sncf.osrd.standalone_sim.result.*
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.sim_infra.utils.recoverBlocks
import fr.sncf.osrd.sim_infra.utils.toList
import fr.sncf.osrd.train.StandaloneTrainSchedule
import fr.sncf.osrd.utils.CurveSimplification
import fr.sncf.osrd.utils.indexing.*
import kotlin.collections.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import kotlin.math.abs
import kotlin.math.max


// TODO: run pathfinding on blocks
private fun recoverBlockPath(
    simulator: SignalingSimulator,
    fullInfra: FullInfra,
    routePath: StaticIdxList<Route>,
): List<BlockPathElement> {
    // TODO: the allowed signaling systems should depend on the type of train
    val sigSystemManager = simulator.sigModuleManager
    val bal = sigSystemManager.findSignalingSystem("BAL")
    val bapr = sigSystemManager.findSignalingSystem("BAPR")
    val tvm = sigSystemManager.findSignalingSystem("TVM")

    val blockPaths = recoverBlocks(
        fullInfra.rawInfra, fullInfra.blockInfra, routePath, mutableStaticIdxArrayListOf(bal, bapr, tvm)
    )
    assert(blockPaths.isNotEmpty())
    return blockPaths[0].toList() // TODO: have a better way to choose the block path
}


/** Use an already computed envelope to extract various metadata about a trip.  */
fun run(
    envelope: Envelope, trainPath: TrainPath, schedule: StandaloneTrainSchedule, fullInfra: FullInfra
): ResultTrain {
    assert(envelope.continuous)

    val rawInfra = fullInfra.rawInfra;
    val loadedSignalInfra = fullInfra.loadedSignalInfra;
    val blockInfra = fullInfra.blockInfra;
    val simulator = fullInfra.signalingSimulator;

    // get a new generation route path
    val routePath = MutableStaticIdxArrayList<Route>()
    for (javaRoute in trainPath.routePath) {
        val route = fullInfra.rawInfra.routeMap[javaRoute.element.infraRoute]!!
        routePath.add(route)
    }

    // recover blocks from the route paths
    val detailedBlockPath = recoverBlockPath(simulator, fullInfra, routePath)
    val blockPath = mutableStaticIdxArrayListOf<Block>()
    for (block in detailedBlockPath)
        blockPath.add(block.block)

    // Compute speeds, head and tail positions
    val envelopeWithStops = EnvelopeStopWrapper(envelope, schedule.stops)
    val trainLength = schedule.rollingStock.length
    var speeds = ArrayList<ResultSpeed>()
    var headPositions = ArrayList<ResultPosition>()
    for (point in envelopeWithStops.iterateCurve()) {
        speeds.add(ResultSpeed(point.time, point.speed, point.position))
        headPositions.add(ResultPosition.from(point.time, point.position, trainPath))
    }

    // Simplify data
    speeds = simplifySpeeds(speeds)
    headPositions = simplifyPositions(headPositions)

    // Compute stops
    val stops = ArrayList<ResultStops>()
    for (stop in schedule.stops) {
        val stopTime = ResultPosition.interpolateTime(stop.position, headPositions)
        stops.add(ResultStops(stopTime, stop.position, stop.duration))
    }

    // Compute signal updates
    val startOffset = trainPathBlockOffset(trainPath)
    val pathSignals = pathSignals(startOffset, blockPath, blockInfra, envelopeWithStops, rawInfra)
    val zoneOccupationChangeEvents =
        zoneOccupationChangeEvents(startOffset, blockPath, blockInfra, envelopeWithStops, rawInfra, trainLength)

    val zoneUpdates = zoneOccupationChangeEvents.map {
        ResultTrain.ZoneUpdate(rawInfra.getZoneName(it.zone), it.time / 1000.0, it.offset.meters, it.isEntry)
    }

    val signalSightings = pathSignals.map {
        val physicalSignal = loadedSignalInfra.getPhysicalSignal(it.signal)
        val sightOffset = max(0.0, (it.offset - rawInfra.getSignalSightDistance(physicalSignal)).meters)
        ResultTrain.SignalSighting(
            rawInfra.getPhysicalSignalName(loadedSignalInfra.getPhysicalSignal(it.signal)),
            envelopeWithStops.interpolateTotalTime(sightOffset),
            sightOffset,
            "VL" // TODO: find out the real state
        )
    }

    // Compute route occupancies
    val routeOccupancies = routeOccupancies(zoneOccupationChangeEvents, rawInfra, envelopeWithStops)

    // Compute energy consumed
    val envelopePath = EnvelopeTrainPath.from(trainPath)
    val mechanicalEnergyConsumed =
        EnvelopePhysics.getMechanicalEnergyConsumed(envelope, envelopePath, schedule.rollingStock)

    val spacingRequirements = spacingRequirements(
        simulator,
        blockPath,
        loadedSignalInfra,
        blockInfra,
        envelopeWithStops,
        rawInfra,
        pathSignals,
        zoneOccupationChangeEvents
    )

    return ResultTrain(
        speeds,
        headPositions,
        stops,
        routeOccupancies,
        mechanicalEnergyConsumed,
        signalSightings,
        zoneUpdates,
        spacingRequirements,
    )
}

private fun spacingRequirements(
    simulator: SignalingSimulator,
    blockPath: StaticIdxList<Block>,
    loadedSignalInfra: LoadedSignalInfra,
    blockInfra: BlockInfra,
    envelope: EnvelopeTimeInterpolate,
    rawInfra: SimInfraAdapter,
    pathSignals: List<PathSignal>,
    zoneOccupationChangeEvents: MutableList<ZoneOccupationChangeEvent>
): List<SpacingRequirement> {
    val res = mutableListOf<SpacingRequirement>()
    val zoneReleases = zoneOccupationChangeEvents.groupBy { it.zone }.mapValues { (_, events) ->
        assert(events.size <= 2);
        val exit = events.last()
        if (exit.isEntry)
            envelope.totalTime;
        else
            exit.time / 1000.0;
    }
    val zoneMap = arrayListOf<ZoneId>()
    var zoneCount = 0
    for (block in blockPath) {
        for (zonePath in blockInfra.getBlockPath(block)) {
            val zone = rawInfra.getNextZone(rawInfra.getZonePathEntry(zonePath))!!
            zoneMap.add(zone)
            zoneCount++
        }
    }

    for (pathSignal in pathSignals) {
        val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
        val sightOffset = max(0.0, (pathSignal.offset - rawInfra.getSignalSightDistance(physicalSignal)).meters)
        val sightTime = envelope.interpolateTotalTime(sightOffset)

        val signalZoneOffset =
            blockPath.take(pathSignal.blockIndexInPath + 1).sumOf { blockInfra.getBlockPath(it).size }

        val zoneStates = ArrayList<ZoneStatus>(zoneCount)
        for (i in 0 until zoneCount) zoneStates.add(ZoneStatus.CLEAR)

        var lastConstrainingZone: Int? = null
        for (i in signalZoneOffset until zoneCount) {
            zoneStates[i] = ZoneStatus.OCCUPIED
            val simulatedSignalStates = simulator.evaluate(
                rawInfra, loadedSignalInfra, blockInfra,
                blockPath, 0, blockPath.size,
                zoneStates, ZoneStatus.CLEAR
            )
            zoneStates[i] = ZoneStatus.CLEAR
            val signalState = simulatedSignalStates[pathSignal.signal]!!
            if (signalState.getEnum("aspect") != "VL") { // FIXME: Have a better way to check if the signal is constraining
                lastConstrainingZone = i;
            } else
                break;
        }
        if (lastConstrainingZone == null)
            continue;

        val zone = zoneMap[lastConstrainingZone]
        val zoneName = rawInfra.getZoneName(zone)
        val releaseTime = zoneReleases[zone]?: envelope.totalTime;
        res.add(SpacingRequirement(zoneName, sightTime, releaseTime))
    }
    return res
}

private fun routeOccupancies(
    zoneOccupationChangeEvents: MutableList<ZoneOccupationChangeEvent>,
    rawInfra: SimInfraAdapter,
    envelope: EnvelopeTimeInterpolate
): Map<String, ResultOccupancyTiming> {
    val routeOccupancies = mutableMapOf<String, ResultOccupancyTiming>()
    val zoneOccupationChangeEventsByRoute = mutableMapOf<String, MutableList<ZoneOccupationChangeEvent>>()
    for (event in zoneOccupationChangeEvents) {
        for (route in rawInfra.zoneMap.inverse()[event.zone]!!.routes) {
            zoneOccupationChangeEventsByRoute.getOrPut(route.id) { mutableListOf() }.add(event)
        }
    }

    for ((route, events) in zoneOccupationChangeEventsByRoute) {
        events.sortBy { it.time }
        val entry = events.first()
        assert(entry.isEntry)
        val exit = events.last()
        if (exit.isEntry) {
            routeOccupancies[route] = ResultOccupancyTiming(entry.time.toDouble() / 1000, envelope.totalTime)
            continue;
        }
        routeOccupancies[route] = ResultOccupancyTiming(entry.time.toDouble() / 1000, exit.time.toDouble() / 1000)
    }
    return routeOccupancies
}

private data class ZoneOccupationChangeEvent(
    val time: Long,
    val offset: Distance,
    val zoneIndexInPath: Int,
    val isEntry: Boolean,
    val blockIdx: Int,
    val zone: ZoneId,
)

private fun zoneOccupationChangeEvents(
    startOffset: Distance,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    envelope: EnvelopeTimeInterpolate,
    rawInfra: SimInfraAdapter,
    trainLength: Double
): MutableList<ZoneOccupationChangeEvent> {
    var zoneCount = 0
    var currentOffset = startOffset
    val zoneOccupationChangeEvents = mutableListOf<ZoneOccupationChangeEvent>()
    for ((blockIdx, block) in blockPath.withIndex()) {
        for (zonePath in blockInfra.getBlockPath(block)) {
            // Compute occupation change event
            if (currentOffset > envelope.endPos.meters) break
            val entryOffset = maxOf(0.meters, currentOffset)
            val entryTime = envelope.interpolateTotalTimeMS(entryOffset.meters)
            val zone = rawInfra.getNextZone(rawInfra.getZonePathEntry(zonePath))!!
            zoneOccupationChangeEvents.add(
                ZoneOccupationChangeEvent(
                    entryTime, entryOffset, zoneCount, true, blockIdx, zone
                )
            )
            currentOffset += rawInfra.getZonePathLength(zonePath)
            if (currentOffset > envelope.endPos.meters) {
                zoneCount++
                break
            }
            val exitOffset = maxOf(0.meters, currentOffset + trainLength.meters)
            if (exitOffset <= envelope.endPos.meters) {
                val exitTime = envelope.interpolateTotalTimeMS(exitOffset.meters)
                zoneOccupationChangeEvents.add(
                    ZoneOccupationChangeEvent(
                        exitTime,
                        exitOffset,
                        zoneCount,
                        false,
                        blockIdx,
                        zone,
                    )
                )
            }
            zoneCount++
        }
    }
    zoneOccupationChangeEvents.sortBy { it.time }
    // TODO: verify we don't generate entry and exits at the same time (especially at 0)

    return zoneOccupationChangeEvents
}

data class PathSignal(val signal: LogicalSignalId, val offset: Distance, val blockIndexInPath: Int)

// This doesn't generate path signals outside the envelope
// The reason being that even if a train see a red signal, it won't
// matter since the train was going to stop before it anyway
private fun pathSignals(
    startOffset: Distance,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    envelope: EnvelopeTimeInterpolate,
    rawInfra: SimInfraAdapter
): MutableList<PathSignal> {
    val pathSignals = mutableListOf<PathSignal>()
    var currentOffset = startOffset
    for ((blockIdx, block) in blockPath.withIndex()) {
        val blockSignals = blockInfra.getBlockSignals(block)
        val blockSignalPositions = blockInfra.getSignalsPositions(block)
        val numExclusiveSignalInBlock =
            if (blockIdx == blockPath.size - 1) blockSignals.size else blockSignals.size - 1
        for ((signal, position) in blockSignals.zip(blockSignalPositions).take(numExclusiveSignalInBlock)) {
            val signalOffset = currentOffset + position
            if (0.meters < signalOffset && signalOffset < envelope.endPos.meters)
                pathSignals.add(PathSignal(signal, signalOffset, blockIdx))
        }

        for (zonePath in blockInfra.getBlockPath(block)) {
            if (currentOffset > envelope.endPos.meters) break

            currentOffset += rawInfra.getZonePathLength(zonePath)
            if (currentOffset > envelope.endPos.meters) {
                break
            }
        }
    }

    return pathSignals
}

/**
 * Computes the offset between the beginning of the first block and the beginning of the train path - and
 * thus of the envelope
 */
fun trainPathBlockOffset(trainPath: TrainPath): Distance {
    return trainPath.routePath.first().pathOffset.meters
}

private fun simplifyPositions(
    positions: ArrayList<ResultPosition>
): ArrayList<ResultPosition> {
    return CurveSimplification.rdp(
        positions, 5.0
    ) { point: ResultPosition, start: ResultPosition, end: ResultPosition ->
        if (abs(start.time - end.time) < 0.000001) return@rdp abs(point.pathOffset - start.pathOffset)
        val proj =
            start.pathOffset + (point.time - start.time) * (end.pathOffset - start.pathOffset) / (end.time - start.time)
        abs(point.pathOffset - proj)
    }
}

private fun simplifySpeeds(speeds: ArrayList<ResultSpeed>): ArrayList<ResultSpeed> {
    return CurveSimplification.rdp(
        speeds, 0.2
    ) { point: ResultSpeed, start: ResultSpeed, end: ResultSpeed ->
        if (abs(start.position - end.position) < 0.000001) return@rdp abs(point.speed - start.speed)
        val proj =
            start.speed + (point.position - start.position) * (end.speed - start.speed) / (end.position - start.position)
        abs(point.speed - proj)
    }
}
