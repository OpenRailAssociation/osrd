package fr.sncf.osrd.conflicts

import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra
import fr.sncf.osrd.sim_infra.api.getZoneName
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter
import fr.sncf.osrd.standalone_sim.result.ResultTrain
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.indexing.IdxMap
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.meters


/*
suspend fun routingRequirements(
    rawInfra: SimInfraAdapter,
    blockInfra: BlockInfra,
    loadedSignalInfra: LoadedSignalInfra,
    rollingStock: RollingStock,
    simulator: SignalingSimulator,
    initialPath: PathFragment,
    driver: IncrementalRequirementCallbacks,
): List<ResultTrain.RoutingRequirement> {
    val incrementalPath = IncrementalBlockPath(initialPath)
    suspend fun findRouteSetDeadline(routeIndex: Int): Double? {
        if (routeIndex == 0)
        // TODO: this isn't quite true when the path starts with a stop
            return 0.0

        // find the first block of the route
        val routeStartBlockIndex = incrementalPath.routeBlockBounds[routeIndex]
        val firstRouteBlock = incrementalPath.blockPath[routeStartBlockIndex]

        // find the entry signal for this route. if there is no entry signal,
        // the set deadline is the start of the simulation
        if (blockInfra.blockStartAtBufferStop(firstRouteBlock))
            return 0.0

        // simulate signaling on the train's path with all zones free,
        // until the start of the route, which is INCOMPATIBLE
        val zoneStates = mutableListOf<ZoneStatus>()
        for (i in 0 until incrementalPath.zoneCount)
            zoneStates.add(ZoneStatus.CLEAR)

        // TODO: the complexity of finding route set deadlines is currently n^2 of the number of blocks
        //   in the path. it can be improved upon by only simulating blocks which can contain the route's
        //   limiting signal
        val simulatedSignalStates = simulator.evaluate(
            rawInfra, loadedSignalInfra, blockInfra,
            incrementalPath.blockPath, 0, routeStartBlockIndex,
            zoneStates, ZoneStatus.INCOMPATIBLE
        )

        // find the first non-open signal on the path
        // iterate backwards on blocks from blockIndex to 0, and on signals
        val limitingSignalSpec = findLimitingSignal(blockInfra, simulatedSignalStates, incrementalPath.blockPath, routeStartBlockIndex)
            ?: return null
        val limitingBlock = incrementalPath.blockPath[limitingSignalSpec.blockIndex]
        val signal = blockInfra.getBlockSignals(limitingBlock)[limitingSignalSpec.signalIndex]
        val signalOffset = blockInfra.getSignalsPositions(limitingBlock)[limitingSignalSpec.signalIndex]

        val blockOffset = incrementalPath.blockOffsets[limitingSignalSpec.blockIndex]
        val sightDistance = rawInfra.getSignalSightDistance(rawInfra.getPhysicalSignal(signal))

        // find the location at which establishing the route becomes necessary
        val criticalPos = (blockOffset + signalOffset - sightDistance) - startOffset

        // find when the train meets the critical location
        return driver.clampInterpolate(criticalPos)
    }

    val res = mutableListOf<ResultTrain.RoutingRequirement>()
    var routePathOffset = 0.meters
    // for all routes, generate requirements
    for (routeIndex in 0 until incrementalPath.routePath.size) {
        // start out by figuring out when the route needs to be set
        // when the route is set, signaling can allow the train to proceed
        val routeSetDeadline = findRouteSetDeadline(routeIndex)?: continue

        // find the release time of the last zone of each release group
        val route = incrementalPath.routePath[routeIndex]
        val routeZonePath = rawInfra.getRoutePath(route)
        val zoneRequirements = mutableListOf<ResultTrain.RoutingZoneRequirement>()
        for (zonePathIndex in 0 until routeZonePath.size) {
            val zonePath = routeZonePath[zonePathIndex]
            routePathOffset += rawInfra.getZonePathLength(zonePath)
            // the distance to the end of the zone from the start of the train path
            val pathOffset = routePathOffset - startOffset
            // the point in the train path at which the zone is released
            val criticalPos = pathOffset + rollingStock.length.meters
            // if the zones are never occupied by the train, no requirement is emitted
            if (criticalPos < 0.meters) {
                assert(routeIndex == 0)
                continue
            }
            val criticalTime = driver.clampInterpolate(criticalPos)
            zoneRequirements.add(routingZoneRequirement(rawInfra, zonePath, criticalTime))
        }
        res.add(
            ResultTrain.RoutingRequirement(
                rawInfra.getRouteName(route),
                routeSetDeadline,
                zoneRequirements,
            )
        )
    }
    return res
}

/** Create a zone requirement, which embeds all needed properties for conflict detection */
private fun routingZoneRequirement(rawInfra: RawInfra, zonePath: ZonePathId, endTime: Double): ResultTrain.RoutingZoneRequirement {
    val zoneName = rawInfra.getZoneName(rawInfra.getNextZone(rawInfra.getZonePathEntry(zonePath))!!)
    val zoneEntry = rawInfra.getZonePathEntry(zonePath)
    val zoneExit = rawInfra.getZonePathExit(zonePath)
    val resSwitches = mutableMapOf<String, String>()
    val switches = rawInfra.getZonePathMovableElements(zonePath)
    val switchConfigs = rawInfra.getZonePathMovableElementsConfigs(zonePath)
    for ((switch, config) in switches zip switchConfigs)
        resSwitches[rawInfra.getTrackNodeName(switch)] = rawInfra.getTrackNodeConfigName(switch, config)
    return ResultTrain.RoutingZoneRequirement(
        zoneName,
        "${zoneEntry.direction.name}:${rawInfra.getDetectorName(zoneEntry.value)}",
        "${zoneExit.direction.name}:${rawInfra.getDetectorName(zoneExit.value)}",
        resSwitches,
        endTime,
    )
}

data class LimitingSignal(val blockIndex: Int, val signalIndex: Int)

/**
 * For any given train path, each route must be set prior to the train reaching some location.
 * This location is the point at which the driver first sees the first signal to incur a slowdown.
 * This signal is the limiting signal.
 */
private fun findLimitingSignal(
    blockInfra: BlockInfra,
    simulatedSignalStates: IdxMap<LogicalSignalId, SigState>,
    blockPath: StaticIdxList<Block>,
    routeStartBlockIndex: Int
): LimitingSignal? {
    var lastSignalBlockIndex = -1
    var lastSignalIndex = -1
    for (curBlockIndex in (0 until routeStartBlockIndex).reversed()) {
        val curBlock = blockPath[curBlockIndex]
        val blockSignals = blockInfra.getBlockSignals(curBlock)
        val signalIndexStart = if (curBlockIndex == 0) 0 else 1
        for (curSignalIndex in (signalIndexStart until blockSignals.size).reversed()) {
            val signal = blockSignals[curSignalIndex]
            val signalState = simulatedSignalStates[signal]!!
            // TODO: make this generic
            if (signalState.getEnum("aspect") == "VL")
                break
            lastSignalBlockIndex = curBlockIndex
            lastSignalIndex = curSignalIndex
        }
    }
    // Limiting signal not found
    if (lastSignalBlockIndex == -1 || lastSignalIndex == -1)
        return null
    return LimitingSignal(lastSignalBlockIndex, lastSignalIndex)
}

 */
