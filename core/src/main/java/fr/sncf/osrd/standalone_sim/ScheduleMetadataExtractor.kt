@file:JvmName("ScheduleMetadataExtractor")

package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopePhysics
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.bal.BAL
import fr.sncf.osrd.signaling.bal.BALtoBAL
import fr.sncf.osrd.signaling.bal.BALtoBAPR
import fr.sncf.osrd.signaling.bapr.BAPR
import fr.sncf.osrd.signaling.bapr.BAPRtoBAL
import fr.sncf.osrd.signaling.bapr.BAPRtoBAPR
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter
import fr.sncf.osrd.sim_infra_adapter.adaptRawInfra
import fr.sncf.osrd.standalone_sim.result.*
import fr.sncf.osrd.train.StandaloneTrainSchedule
import fr.sncf.osrd.utils.CurveSimplification
import fr.sncf.osrd.utils.indexing.*
import java.awt.Color
import kotlin.math.abs


/** Use an already computed envelope to extract various metadata about a trip.  */
fun run(
    envelope: Envelope, trainPath: TrainPath, schedule: StandaloneTrainSchedule, infra: SignalingInfra
): ResultTrain {
    assert(envelope.continuous)

    // Load the kotlin infra
    // TODO: don't do it here
    val sigSystemManager = SigSystemManagerImpl()
    val bal = sigSystemManager.addSignalingSystem(BAL)
    val bapr = sigSystemManager.addSignalingSystem(BAPR)
    sigSystemManager.addSignalDriver(BALtoBAL)
    sigSystemManager.addSignalDriver(BALtoBAPR)
    sigSystemManager.addSignalDriver(BAPRtoBAPR)
    sigSystemManager.addSignalDriver(BAPRtoBAL)
    val rawInfra = adaptRawInfra(infra)
    val simulator = SignalingSimulatorImpl(sigSystemManager)
    val loadedSignalInfra = simulator.loadSignals(rawInfra)
    val blockInfra = simulator.buildBlocks(rawInfra, loadedSignalInfra)

    // Get the route path
    // TODO: do it in the pathfinding
    val routes = MutableStaticIdxArrayList<Route>()
    for (javaRoute in trainPath.routePath) {
        val route = rawInfra.routeMap[javaRoute.element.infraRoute]!!
        routes.add(route)
    }
    val blockPaths = getRouteBlocks(
        rawInfra, blockInfra, routes, mutableStaticIdxArrayListOf(bal, bapr)
    )
    assert(blockPaths.isNotEmpty())
    val blockPath = blockPaths[0] // TODO: have a better way to choose the block path

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
    val startOffset = trainPathBlockOffset(blockInfra, rawInfra, trainPath, blockPath)
    val pathSignals = pathSignals(startOffset, blockPath, blockInfra, envelope, rawInfra)
    val zoneOccupationChangeEvents =
        zoneOccupationChangeEvents(startOffset, blockPath, blockInfra, envelope, rawInfra, trainLength)
    val signalAspectChangeEvents = computeSignalAspectChangeEvents(
        blockPath, blockInfra, pathSignals, zoneOccupationChangeEvents, simulator, rawInfra, loadedSignalInfra
    )
    val signalUpdates = signalUpdates(pathSignals, signalAspectChangeEvents, loadedSignalInfra, rawInfra, envelope)

    // Compute route occupancies
    val routeOccupancies = routeOccupancies(zoneOccupationChangeEvents, rawInfra, envelope)

    // Compute energy consumed
    val envelopePath = EnvelopeTrainPath.from(trainPath)
    val mechanicalEnergyConsumed =
        EnvelopePhysics.getMechanicalEnergyConsumed(envelope, envelopePath, schedule.rollingStock)

    return ResultTrain(
        speeds, headPositions, stops, routeOccupancies, signalUpdates, mechanicalEnergyConsumed
    )
}

private fun routeOccupancies(
    zoneOccupationChangeEvents: MutableList<ZoneOccupationChangeEvent>, rawInfra: SimInfraAdapter, envelope: Envelope
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
        }
        routeOccupancies[route] = ResultOccupancyTiming(entry.time.toDouble() / 1000, exit.time.toDouble() / 1000)
    }
    return routeOccupancies
}

private data class SignalAspectChangeEvent(val newAspect: String, val time: Long, val offset: Distance)
private data class ZoneOccupationChangeEvent(
    val time: Long,
    val offset: Distance,
    val zoneIndexInPath: Int,
    val isEntry: Boolean,
    val blockIdx: Int,
    val zone: ZoneId,
)

private data class PathSignal(val signal: LogicalSignalId, val offset: Distance)

private fun zoneOccupationChangeEvents(
    startOffset: Distance,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    envelope: Envelope,
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
    return zoneOccupationChangeEvents
}

private fun pathSignals(
    startOffset: Distance,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    envelope: Envelope,
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
            pathSignals.add(PathSignal(signal, currentOffset + position))
        }

        for (zonePath in blockInfra.getBlockPath(block)) {
            // Compute occupation change event
            if (currentOffset > envelope.endPos.meters) break

            currentOffset += rawInfra.getZonePathLength(zonePath)
            if (currentOffset > envelope.endPos.meters) {
                break
            }

        }
    }

    return pathSignals
}

private fun computeSignalAspectChangeEvents(
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    pathSignals: List<PathSignal>,
    zoneOccupationChangeEvents: MutableList<ZoneOccupationChangeEvent>,
    simulator: SignalingSimulatorImpl,
    rawInfra: SimInfraAdapter,
    loadedSignalInfra: LoadedSignalInfra
): Map<PathSignal, MutableList<SignalAspectChangeEvent>> {
    val zoneCount = blockPath.sumOf { blockInfra.getBlockPath(it).size }
    val zoneStates = ArrayList<ZoneStatus>(zoneCount)
    for (i in 0 until zoneCount) zoneStates.add(ZoneStatus.CLEAR)

    val signalAspects = pathSignals.associateBy({ it.signal }, { "VL" })
        .toMutableMap() // TODO: Have a better way to get the least restrictive aspect

    val signalAspectChangeEvents = pathSignals.associateBy({ it }, { mutableListOf<SignalAspectChangeEvent>() })
    for (event in zoneOccupationChangeEvents) {
        if (event.isEntry) {
            zoneStates[event.zoneIndexInPath] = ZoneStatus.OCCUPIED
        } else zoneStates[event.zoneIndexInPath] = ZoneStatus.CLEAR

        val simulatedSignalStates = simulator.evaluate(
            rawInfra, loadedSignalInfra, blockInfra, blockPath, 0, blockPath.size, zoneStates
        )
        val simulatedAspects = simulatedSignalStates.map { it.getEnum("aspect") }
        for (pathSignal in pathSignals) {
            val signal = pathSignal.signal
            val aspect = simulatedAspects[signal] ?: continue
            if (signalAspects[signal]!! == aspect) continue
            signalAspectChangeEvents[pathSignal]!!.add(SignalAspectChangeEvent(aspect, event.time, event.offset))
            signalAspects[signal] = aspect
        }
    }
    return signalAspectChangeEvents
}

private fun signalUpdates(
    signalsOnPath: List<PathSignal>,
    signalAspectChangeEvents: Map<PathSignal, MutableList<SignalAspectChangeEvent>>,
    loadedSignalInfra: LoadedSignalInfra,
    rawInfra: SimInfraAdapter,
    envelope: Envelope
): MutableList<SignalUpdate> {
    val signalUpdates = mutableListOf<SignalUpdate>()

    // Let's generate signal updates for the SNCF GET
    // The logic here is specific to that, signalUpdates shouldn't be used for anything else
    // TODO: maybe have those be specific to the signaling system
    // FIXME: this doesn't work if the train goes through the same signal twice
    // This is probably a weird edge case anyway
    fun blinking(aspect: String): Boolean {
        return false
    }

    fun color(aspect: String): Int {
        return when (aspect) {
            "VL" -> Color.GREEN.rgb
            "A" -> Color.YELLOW.rgb
            "S" -> Color.RED.rgb
            "C" -> Color.RED.rgb
            else -> throw RuntimeException("unknown aspect: $aspect")
        }
    }

    val nextSignal = mutableMapOf<LogicalSignalId, PathSignal>()
    for (i in 0 until signalsOnPath.size - 1) nextSignal[signalsOnPath[i].signal] = signalsOnPath[i + 1]

    for ((pathSignal, events) in signalAspectChangeEvents) {
        val signal = pathSignal.signal
        val physicalSignalId = loadedSignalInfra.getPhysicalSignal(signal)
        val signalId = rawInfra.signalMap.inverse()[physicalSignalId]!!
        val rjsSignal = rawInfra.rjsSignalMap[signalId]!!
        val sightDistance = rjsSignal.sightDistance.meters
        val track = rjsSignal.track
        val trackOffset = rjsSignal.position
        val positionStart = pathSignal.offset
        val positionEnd = if (nextSignal.contains(signal)) nextSignal[signal]!!.offset
        else envelope.endPos.meters

        if (events.isEmpty()) continue

        // Compute the "green" section
        // It happens before the first event
        if (events.first().time != 0L) {
            val event = events.first()
            val timeEnd = event.time
            val trainPositionStart = maxOf(0.meters, positionStart - sightDistance)
            val trainPositionStartMeter = trainPositionStart.meters
            if (trainPositionStartMeter <= envelope.endPos) {
                val timeStart = envelope.interpolateTotalTimeMS(trainPositionStartMeter)
                signalUpdates.add(
                    SignalUpdate(
                        signalId,
                        setOf(),
                        timeStart.toDouble() / 1000,
                        timeEnd.toDouble() / 1000,
                        positionStart.meters,
                        positionEnd.meters,
                        color("VL"),
                        blinking("VL"),
                        "VL",
                        track,
                        trackOffset
                    )
                )
            }
        }

        for (i in 0 until events.size - 1) {
            val event = events[i]
            val nextEvent = events[i + 1]
            val timeStart = event.time
            val timeEnd = nextEvent.time
            signalUpdates.add(
                SignalUpdate(
                    signalId,
                    setOf(),
                    timeStart.toDouble() / 1000,
                    timeEnd.toDouble() / 1000,
                    positionStart.meters,
                    positionEnd.meters,
                    color(event.newAspect),
                    blinking(event.newAspect),
                    event.newAspect,
                    track,
                    trackOffset
                )
            )
        }

        // The last event only generates an update if the signal doesn't return to VL
        if (events.last().newAspect != "VL") {
            val event = events.last()
            val timeStart = event.time
            val timeEnd = envelope.interpolateTotalTimeMS(envelope.endPos)
            signalUpdates.add(
                SignalUpdate(
                    signalId,
                    setOf(),
                    timeStart.toDouble() / 1000,
                    timeEnd.toDouble() / 1000,
                    positionStart.meters,
                    positionEnd.meters,
                    color(event.newAspect),
                    blinking(event.newAspect),
                    event.newAspect,
                    track,
                    trackOffset
                )
            )
        }
    }
    return signalUpdates
}

/**
 * Computes the offset between the beginning of the first block and the beginning of the train path - and
 * thus of the envelope
 */
private fun trainPathBlockOffset(
    blockInfra: BlockInfra, rawInfra: SimInfraAdapter, trainPath: TrainPath, blockPath: StaticIdxList<Block>
): Distance {
    // FIXME: This is bad code. And probably full of bugs.

    val detectors = blockPath.flatMap { blockInfra.getBlockPath(it) }.map { rawInfra.getZonePathEntry(it).detector }
        .map { rawInfra.detectorMap.inverse()[it]!!.id }.toSet()

    return (trainPath.detectionSections.find { detectors.contains(it.element.detectors.first().detector.id) }!!.pathOffset).meters
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
