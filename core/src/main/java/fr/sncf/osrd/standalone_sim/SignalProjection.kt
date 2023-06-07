package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.SignalProjectionEndpoint
import fr.sncf.osrd.api.SignalProjectionEndpoint.SignalProjectionResult
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SignalSighting
import fr.sncf.osrd.standalone_sim.result.ResultTrain.ZoneUpdate
import fr.sncf.osrd.standalone_sim.result.SignalUpdate
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import java.awt.Color

data class SignalAspectChangeEvent(val newAspect: String, val time: Long)

fun project(
    fullInfra: FullInfra,
    trainPath: TrainPath,
    signalSightings: List<SignalSighting>,
    zoneUpdates: List<ZoneUpdate>
): SignalProjectionResult {
    val rawInfra = fullInfra.rawInfra;
    val loadedSignalInfra = fullInfra.loadedSignalInfra;
    val blockInfra = fullInfra.blockInfra;
    val simulator = fullInfra.signalingSimulator;

    // TODO: allowed signaling systems should depend on the type of train
    val sigSystemManager = simulator.sigModuleManager
    val bal = sigSystemManager.findSignalingSystem("BAL")
    val bapr = sigSystemManager.findSignalingSystem("BAPR")
    val tvm = sigSystemManager.findSignalingSystem("TVM")

    // Get the route path
    // TODO: do it in the pathfinding
    val routes = MutableStaticIdxArrayList<Route>()
    for (javaRoute in trainPath.routePath) {
        val route = rawInfra.routeMap[javaRoute.element.infraRoute]!!
        routes.add(route)
    }

    val blockPaths = getRouteBlocks(
        rawInfra, blockInfra, routes, mutableStaticIdxArrayListOf(bal, bapr, tvm)
    )
    assert(blockPaths.isNotEmpty())
    val blockPath = blockPaths[0] // TODO: have a better way to choose the block path

    val zoneMap = mutableMapOf<String, Int>()
    var zoneCount = 0
    for (block in blockPath) {
        for (zonePath in blockInfra.getBlockPath(block)) {
            val zone = rawInfra.getNextZone(rawInfra.getZonePathEntry(zonePath))!!
            val zoneName = rawInfra.getZoneName(zone)
            zoneMap[zoneName] = zoneCount
            zoneCount++
        }
    }

    // compute signal updates
    val startOffset = trainPathBlockOffset(trainPath)
    val pathSignals = pathSignals(startOffset, blockPath, blockInfra, rawInfra)

    val signalAspectChangeEvents = computeSignalAspectChangeEvents(
        blockPath, zoneMap, blockInfra, pathSignals, zoneUpdates, simulator, rawInfra, loadedSignalInfra
    )
    val signalUpdates = signalUpdates(pathSignals, signalAspectChangeEvents, loadedSignalInfra, rawInfra, signalSightings)
    return SignalProjectionResult(signalUpdates)
}

// Returns all the signals on the path
private fun pathSignals(
    startOffset: Distance,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    rawInfra: SimInfraAdapter
): MutableList<PathSignal> {
    val pathSignals = mutableListOf<PathSignal>()
    var currentOffset = startOffset
    for ((blockIdx, block) in blockPath.withIndex()) {
        var blockSize = Distance.ZERO
        for (zonePath in blockInfra.getBlockPath(block)) {
            blockSize += rawInfra.getZonePathLength(zonePath)
        }

        val blockSignals = blockInfra.getBlockSignals(block)
        val blockSignalPositions = blockInfra.getSignalsPositions(block)
        val numExclusiveSignalInBlock =
            if (blockIdx == blockPath.size - 1) blockSignals.size else blockSignals.size - 1
        for ((signal, position) in blockSignals.zip(blockSignalPositions).take(numExclusiveSignalInBlock)) {
            pathSignals.add(PathSignal(signal, currentOffset + position, blockIdx))
        }
        currentOffset += blockSize
    }

    return pathSignals
}


private fun computeSignalAspectChangeEvents(
    blockPath: StaticIdxList<Block>,
    zoneToPathIndexMap: Map<String, Int>,
    blockInfra: BlockInfra,
    pathSignals: List<PathSignal>,
    zoneUpdates: List<ZoneUpdate>,
    simulator: SignalingSimulator,
    rawInfra: SimInfraAdapter,
    loadedSignalInfra: LoadedSignalInfra
): Map<PathSignal, MutableList<SignalAspectChangeEvent>> {
    val zoneCount = blockPath.sumOf { blockInfra.getBlockPath(it).size }
    val zoneStates = ArrayList<ZoneStatus>(zoneCount)
    for (i in 0 until zoneCount) zoneStates.add(ZoneStatus.CLEAR)

    val signalAspects = pathSignals.associateBy({ it.signal }, { "VL" })
        .toMutableMap() // TODO: Have a better way to get the least restrictive aspect

    val signalAspectChangeEvents = pathSignals.associateBy({ it }, { mutableListOf<SignalAspectChangeEvent>() })
    for (event in zoneUpdates) {
        if (!zoneToPathIndexMap.containsKey(event.zone))
            continue
        if (event.isEntry)
            zoneStates[zoneToPathIndexMap[event.zone]!!] = ZoneStatus.OCCUPIED
        else
            zoneStates[zoneToPathIndexMap[event.zone]!!] = ZoneStatus.CLEAR

        val simulatedSignalStates = simulator.evaluate(
            rawInfra, loadedSignalInfra, blockInfra,
            blockPath, 0, blockPath.size,
            zoneStates, ZoneStatus.CLEAR
        )
        val simulatedAspects = simulatedSignalStates.map { it.getEnum("aspect") }
        for (pathSignal in pathSignals) {
            val signal = pathSignal.signal
            val aspect = simulatedAspects[signal] ?: continue
            if (signalAspects[signal]!! == aspect) continue
            signalAspectChangeEvents[pathSignal]!!.add(SignalAspectChangeEvent(aspect, (event.time * 1000).toLong()))
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
    signalSightings: List<SignalSighting>,
    ): MutableList<SignalUpdate> {
    val signalUpdates = mutableListOf<SignalUpdate>()

    // Let's generate signal updates for the SNCF GET
    // The logic here is specific to that, signalUpdates shouldn't be used for anything else
    // TODO: maybe have those be specific to the signaling system
    // FIXME: this doesn't work if the train goes through the same signal twice
    // This is probably a weird edge case anyway
    @Suppress("UNUSED_PARAMETER")
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

    val signalSightingMap = signalSightings.associateBy { it.signal }

    val nextSignal = mutableMapOf<LogicalSignalId, PathSignal>()
    for (i in 0 until signalsOnPath.size - 1) nextSignal[signalsOnPath[i].signal] = signalsOnPath[i + 1]

    for ((pathSignal, events) in signalAspectChangeEvents) {
        val signal = pathSignal.signal
        val physicalSignalId = loadedSignalInfra.getPhysicalSignal(signal)
        val physicalSignalName = rawInfra.getPhysicalSignalName(physicalSignalId)
        val signalId = rawInfra.signalMap.inverse()[physicalSignalId]!!
        val rjsSignal = rawInfra.rjsSignalMap[signalId]!!
        val track = rjsSignal.track
        val trackOffset = rjsSignal.position
        val positionStart = pathSignal.offset
        val positionEnd = if (nextSignal.contains(signal)) nextSignal[signal]!!.offset
        else null

        if (events.isEmpty()) continue

        // Compute the "green" section
        // It happens before the first event
        if (events.first().time != 0L && signalSightingMap.contains(physicalSignalName)) {
            val event = events.first()
            val timeEnd = event.time
            val timeStart = signalSightingMap[physicalSignalName]!!.time
            signalUpdates.add(
                SignalUpdate(
                    signalId,
                    timeStart,
                    timeEnd.toDouble() / 1000,
                    positionStart.meters,
                    positionEnd?.meters,
                    color("VL"),
                    blinking("VL"),
                    "VL",
                    track,
                    trackOffset
                )
            )

        }

        for (i in 0 until events.size - 1) {
            val event = events[i]
            val nextEvent = events[i + 1]
            val timeStart = event.time
            val timeEnd = nextEvent.time
            signalUpdates.add(
                SignalUpdate(
                    signalId,
                    timeStart.toDouble() / 1000,
                    timeEnd.toDouble() / 1000,
                    positionStart.meters,
                    positionEnd?.meters,
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
            signalUpdates.add(
                SignalUpdate(
                    signalId,
                    timeStart.toDouble() / 1000,
                    null,
                    positionStart.meters,
                    positionEnd?.meters,
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
