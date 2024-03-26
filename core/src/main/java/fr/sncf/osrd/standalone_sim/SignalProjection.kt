package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.SignalProjectionEndpoint.SignalProjectionResult
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.utils.recoverBlocks
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SignalSighting
import fr.sncf.osrd.standalone_sim.result.ResultTrain.ZoneUpdate
import fr.sncf.osrd.standalone_sim.result.SignalUpdate
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.toRouteIdList
import java.awt.Color
import kotlin.math.abs

data class SignalAspectChangeEvent(val newAspect: String, val time: Long)

fun project(
    fullInfra: FullInfra,
    chunkPath: ChunkPath,
    routePathIds: List<Int>,
    signalSightings: List<SignalSighting>,
    zoneUpdates: List<ZoneUpdate>
): SignalProjectionResult {
    val rawInfra = fullInfra.rawInfra as SimInfraAdapter
    val loadedSignalInfra = fullInfra.loadedSignalInfra
    val blockInfra = fullInfra.blockInfra
    val simulator = fullInfra.signalingSimulator
    val sigModuleManager = simulator.sigModuleManager

    // TODO: allowed signaling systems should depend on the type of train
    val sigSystemManager = simulator.sigModuleManager
    val bal = sigSystemManager.findSignalingSystem("BAL")
    val bapr = sigSystemManager.findSignalingSystem("BAPR")
    val tvm300 = sigSystemManager.findSignalingSystem("TVM300")
    val tvm430 = sigSystemManager.findSignalingSystem("TVM430")

    val leastConstrainingStates = mutableMapOf<SignalingSystemId, SigState>()
    leastConstrainingStates[bal] = (sigModuleManager.getStateSchema(bal)) { value("aspect", "VL")}
    leastConstrainingStates[bapr] = (sigModuleManager.getStateSchema(bapr)) { value("aspect", "VL")}
    leastConstrainingStates[tvm300] = (sigModuleManager.getStateSchema(tvm300)) { value("aspect", "300VL")}
    leastConstrainingStates[tvm430] = (sigModuleManager.getStateSchema(tvm430)) { value("aspect", "VL")} // FIXME: when TVM 430 is implemented

//    val leastConstrainingSettings = mutableMapOf<SignalingSystemId, SigSettings>()
//    leastConstrainingSettings[bal] = (sigModuleManager.getSettingsSchema(bal)) { value("Nf", "false"); value("jaune_cli", "false")}
//    leastConstrainingSettings[bapr] = (sigModuleManager.getSettingsSchema(bapr)) { value("Nf", "false")}
//    leastConstrainingSettings[tvm300] = (sigModuleManager.getSettingsSchema(tvm300)) { value("Nf", "false")}
//    leastConstrainingSettings[tvm430] = (sigModuleManager.getSettingsSchema(tvm430)) { value("Nf", "false")} // FIXME: when TVM 430 is implemented

    // Recover blocks from the route path
    val routePath = toRouteIdList(routePathIds)
    val detailedBlockPath = recoverBlockPath(simulator, fullInfra, routePath)
    val blockPath = mutableStaticIdxArrayListOf<Block>()
    for (block in detailedBlockPath) blockPath.add(block.block)

    val blockPaths =
        recoverBlocks(
            rawInfra,
            blockInfra,
            routePath,
            mutableStaticIdxArrayListOf(bal, bapr, tvm300, tvm430)
        )
    assert(blockPaths.isNotEmpty())

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

    // Compute signal updates
    val startOffset =
        trainPathBlockOffset(fullInfra.rawInfra, fullInfra.blockInfra, blockPath, chunkPath)
    val pathSignals = pathSignals(startOffset, blockPath, blockInfra)
    if (pathSignals.isEmpty())
        return SignalProjectionResult(listOf())

    val signalAspectChangeEvents =
        computeSignalAspectChangeEvents(
            blockPath,
            routePath,
            zoneMap,
            blockInfra,
            pathSignals,
            zoneUpdates,
            simulator,
            rawInfra,
            loadedSignalInfra,
            leastConstrainingStates,
        )
    val signalUpdates =
        signalUpdates(
            pathSignals,
            signalAspectChangeEvents,
            loadedSignalInfra,
            rawInfra,
            signalSightings
        )
    return SignalProjectionResult(signalUpdates)
}

private fun computeSignalAspectChangeEvents(
    blockPath: StaticIdxList<Block>,
    routePath: StaticIdxList<Route>,
    zoneToPathIndexMap: Map<String, Int>,
    blockInfra: BlockInfra,
    pathSignals: List<PathSignal>,
    zoneUpdates: List<ZoneUpdate>,
    simulator: SignalingSimulator,
    rawInfra: SimInfraAdapter,
    loadedSignalInfra: LoadedSignalInfra,
    leastConstrainingStates: Map<SignalingSystemId, SigState>,
): Map<PathSignal, MutableList<SignalAspectChangeEvent>> {
    val routes = routePath.toList()
    val zoneCount = blockPath.sumOf { blockInfra.getBlockPath(it).size }
    val zoneStates = ArrayList<ZoneStatus>(zoneCount)
    for (i in 0 until zoneCount) zoneStates.add(ZoneStatus.CLEAR)

    val signalAspects =
        pathSignals
            .associateBy({ it.signal }, { leastConstrainingStates[loadedSignalInfra.getSignalingSystem(it.signal)]!!.getEnum("aspect") })
            .toMutableMap()

    val lastSignal = pathSignals.last().signal
    val lastSignalDriver = loadedSignalInfra.getDrivers(lastSignal).lastOrNull()
    val lastSignalInputSystem = if (lastSignalDriver != null) {
        simulator.sigModuleManager.getInputSignalingSystem(lastSignalDriver)
    } else {
        loadedSignalInfra.getSignalingSystem(lastSignal) // If it could connect to anything, lets pretend it does to itself
    }
    val nextSignalState = leastConstrainingStates[lastSignalInputSystem]!!


    val signalAspectChangeEvents =
        pathSignals.associateBy({ it }, { mutableListOf<SignalAspectChangeEvent>() })
    for (event in zoneUpdates) {
        if (!zoneToPathIndexMap.containsKey(event.zone)) continue
        if (event.isEntry) zoneStates[zoneToPathIndexMap[event.zone]!!] = ZoneStatus.OCCUPIED
        else zoneStates[zoneToPathIndexMap[event.zone]!!] = ZoneStatus.CLEAR

        val simulatedSignalStates =
            simulator.evaluate(
                rawInfra,
                loadedSignalInfra,
                blockInfra,
                blockPath,
                routes,
                blockPath.size,
                zoneStates,
                ZoneStatus.CLEAR,
                nextSignalState
            )
        val simulatedAspects = simulatedSignalStates.mapValues { it.value.getEnum("aspect") }
        for (pathSignal in pathSignals) {
            val signal = pathSignal.signal
            val aspect = simulatedAspects[signal] ?: continue
            if (signalAspects[signal]!! == aspect) continue
            signalAspectChangeEvents[pathSignal]!!.add(
                SignalAspectChangeEvent(aspect, Math.round(event.time * 1000))
            )
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
    fun blinking(aspect: String): Boolean {
        return aspect == "(A)"
    }

    fun color(aspect: String): Int {
        return when (aspect) {
            "VL" -> Color.GREEN.rgb
            "A" -> Color.YELLOW.rgb
            "(A)" -> Color.YELLOW.rgb
            "S" -> Color.RED.rgb
            "C" -> Color.RED.rgb
            "300VL" -> Color.GREEN.rgb
            "300(VL)" -> Color.GRAY.rgb
            "270A" -> Color.GRAY.rgb
            "220A" -> Color.GRAY.rgb
            "160A" -> Color.GRAY.rgb
            "080A" -> Color.GRAY.rgb
            "000" -> Color.GRAY.rgb
            "RRR" -> Color.RED.rgb
            "OCCUPIED" -> Color.RED.rgb
            else -> throw OSRDError.newAspectError(aspect)
        }
    }

    val signalSightingMap = signalSightings.associateBy { it.signal }

    val nextSignal = mutableMapOf<LogicalSignalId, PathSignal>()
    for (i in 0 until signalsOnPath.size - 1) nextSignal[signalsOnPath[i].signal] =
        signalsOnPath[i + 1]

    for ((pathSignal, events) in signalAspectChangeEvents) {
        val signal = pathSignal.signal
        val physicalSignalId = loadedSignalInfra.getPhysicalSignal(signal)
        val physicalSignalName = rawInfra.getPhysicalSignalName(physicalSignalId)
        val signalId = rawInfra.signalMap.inverse()[physicalSignalId]!!
        val rjsSignal = rawInfra.rjsSignalMap[signalId]!!
        val track = rjsSignal.track
        val trackOffset = rjsSignal.position
        val positionStart = pathSignal.pathOffset
        val positionEnd = if (nextSignal.contains(signal)) nextSignal[signal]!!.pathOffset else null

        if (events.isEmpty()) continue

        // Compute the "green" section
        // It happens before the first event
        if (events.first().time != 0L && signalSightingMap.contains(physicalSignalName)) {
            val event = events.first()
            val timeEnd = event.time.toDouble() / 1000
            val timeStart = signalSightingMap[physicalSignalName]!!.time
            if (abs(timeStart - timeEnd) > 0.1) {
                signalUpdates.add(
                    SignalUpdate(
                        signalId,
                        timeStart,
                        timeEnd,
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
        if (events.last().newAspect != "VL" && events.last().newAspect != "300VL") {
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
