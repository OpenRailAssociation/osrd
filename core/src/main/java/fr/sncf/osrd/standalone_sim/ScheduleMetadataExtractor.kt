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
import fr.sncf.osrd.standalone_sim.result.ResultTrain.RoutingRequirement
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.sim_infra.utils.recoverBlocks
import fr.sncf.osrd.sim_infra.utils.toList
import fr.sncf.osrd.standalone_sim.result.ResultTrain.RoutingZoneRequirement
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SignalSighting
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.StandaloneTrainSchedule
import fr.sncf.osrd.utils.CurveSimplification
import fr.sncf.osrd.utils.indexing.*
import kotlin.collections.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.MutableDistanceArray
import fr.sncf.osrd.utils.units.meters
import mu.KotlinLogging
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min


private val logger = KotlinLogging.logger {}


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
    val pathSignals = pathSignalsInEnvelope(startOffset, blockPath, blockInfra, envelopeWithStops, rawInfra)
    val zoneOccupationChangeEvents =
        zoneOccupationChangeEvents(startOffset, blockPath, blockInfra, envelopeWithStops, rawInfra, trainLength)

    val zoneUpdates = zoneOccupationChangeEvents.map {
        ResultTrain.ZoneUpdate(rawInfra.getZoneName(it.zone), it.time / 1000.0, it.offset.meters, it.isEntry)
    }

    val signalSightings = mutableListOf<SignalSighting>()
    for ((i, pathSignal) in pathSignals.withIndex()) {
        val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
        var sightOffset = max(0.0, (pathSignal.pathOffset - rawInfra.getSignalSightDistance(physicalSignal)).meters)
        if (i > 0) {
            val previousSignalOffset = pathSignals[i - 1].pathOffset.meters
            sightOffset = max(sightOffset, previousSignalOffset);
        }
        signalSightings.add(SignalSighting(
            rawInfra.getPhysicalSignalName(loadedSignalInfra.getPhysicalSignal(pathSignal.signal)),
            envelopeWithStops.interpolateTotalTime(sightOffset),
            sightOffset,
            "VL" // TODO: find out the real state
        ))
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

    val routingRequirements = routingRequirements(
        startOffset,
        simulator,
        routePath,
        blockPath,
        detailedBlockPath,
        loadedSignalInfra,
        blockInfra,
        envelopeWithStops,
        rawInfra,
        schedule.rollingStock,
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
        routingRequirements,
    )
}

enum class SpacingRequirementPhase {
    HeadRoom,
    Begin,
    Main,
    End,
    TailRoom;

    /** Checks whether the current state accepts this zone configuration */
    fun check(occupied: Boolean, hasRequirement: Boolean): Boolean {
        return when (this) {
            HeadRoom -> !occupied && !hasRequirement
            Begin -> occupied && !hasRequirement
            Main -> occupied && hasRequirement
            End -> !occupied && hasRequirement
            TailRoom -> !occupied && !hasRequirement
        }
    }

    fun react(occupied: Boolean, hasRequirement: Boolean): SpacingRequirementPhase {
        // no state change
        if (check(occupied, hasRequirement))
            return this

        when (this) {
            HeadRoom -> {
                if (occupied)
                    return Begin.react(true, hasRequirement)
            }
            Begin -> {
                if (hasRequirement)
                    return Main.react(occupied, true)
                if (!occupied)
                    return TailRoom
            }
            Main -> {
                if (!occupied)
                    return End.react(false, hasRequirement)
            }
            End -> {
                if (!hasRequirement)
                    return TailRoom

            }
            TailRoom -> return TailRoom
        }
        return this
    }
}

private fun routingRequirements(
    // the start offset is the distance from the start of the first route to the start location
    startOffset: Distance,
    simulator: SignalingSimulator,
    routePath: StaticIdxList<Route>,
    blockPath: StaticIdxList<Block>,
    detailedBlockPath: List<BlockPathElement>,
    loadedSignalInfra: LoadedSignalInfra,
    blockInfra: BlockInfra,
    envelope: EnvelopeTimeInterpolate,
    rawInfra: SimInfraAdapter,
    rollingStock: RollingStock,
): List<RoutingRequirement> {
    // count the number of zones in the path
    val zoneCount = routePath.sumOf { rawInfra.getRoutePath(it).size }

    // fill a lookup table mapping route indices to the index of the route's first block
    val routeBlockBounds = IntArray(routePath.size + 1)
    var lastRoute = -1
    for (blockIndex in detailedBlockPath.indices) {
        val block = detailedBlockPath[blockIndex]
        if (block.routeIndex == lastRoute)
            continue
        lastRoute = block.routeIndex
        routeBlockBounds[lastRoute] = blockIndex
    }
    routeBlockBounds[routePath.size] = detailedBlockPath.size

    val blockOffsets = MutableDistanceArray(blockPath.size) { 0.meters }
    var curOffset = 0.meters
    for (i in 0 until blockPath.size) {
        blockOffsets[i] = curOffset
        val blockLength = blockInfra.getBlockPath(blockPath[i]).fold(0.meters) {
                acc, zonePath -> acc + rawInfra.getZonePathLength(zonePath)
        }
        curOffset += blockLength
    }

    fun findRouteSetDeadline(routeIndex: Int): Double? {
        if (routeIndex == 0)
            // TODO: this isn't quite true when the path starts with a stop
            return 0.0

        // find the first block of the route
        val routeStartBlockIndex = routeBlockBounds[routeIndex]
        val firstRouteBlock = detailedBlockPath[routeStartBlockIndex].block

        // find the entry signal for this route. if there is no entry signal,
        // the set deadline is the start of the simulation
        if (blockInfra.blockStartAtBufferStop(firstRouteBlock))
            return 0.0

        // simulate signaling on the train's path with all zones free,
        // until the start of the route, which is INCOMPATIBLE
        val zoneStates = mutableListOf<ZoneStatus>()
        for (i in 0 until zoneCount)
            zoneStates.add(ZoneStatus.CLEAR)

        // TODO: the complexity of finding route set deadlines is currently n^2 of the number of blocks
        //   in the path. it can be improved upon by only simulating blocks which can contain the route's
        //   limiting signal
        val simulatedSignalStates = simulator.evaluate(
            rawInfra, loadedSignalInfra, blockInfra,
            blockPath, 0, routeStartBlockIndex,
            zoneStates, ZoneStatus.INCOMPATIBLE
        )

        // find the first non-open signal on the path
        // iterate backwards on blocks from blockIndex to 0, and on signals
        val limitingSignalSpec = findLimitingSignal(blockInfra, simulatedSignalStates, blockPath, routeStartBlockIndex)
            ?: return null
        val limitingBlock = blockPath[limitingSignalSpec.blockIndex]
        val signal = blockInfra.getBlockSignals(limitingBlock)[limitingSignalSpec.signalIndex]
        val signalOffset = blockInfra.getSignalsPositions(limitingBlock)[limitingSignalSpec.signalIndex]

        val blockOffset = blockOffsets[limitingSignalSpec.blockIndex]
        val sightDistance = rawInfra.getSignalSightDistance(rawInfra.getPhysicalSignal(signal))

        // find the location at which establishing the route becomes necessary
        val criticalPos = (blockOffset + signalOffset - sightDistance) - startOffset

        // find when the train meets the critical location
        return envelope.clampInterpolate(criticalPos)
    }

    val res = mutableListOf<RoutingRequirement>()
    var routePathOffset = 0.meters
    // for all routes, generate requirements
    for (routeIndex in 0 until routePath.size) {
        // start out by figuring out when the route needs to be set
        // when the route is set, signaling can allow the train to proceed
        val routeSetDeadline = findRouteSetDeadline(routeIndex)?: continue

        // find the release time of the last zone of each release group
        val route = routePath[routeIndex]
        val routeZonePath = rawInfra.getRoutePath(route)
        val zoneRequirements = mutableListOf<RoutingZoneRequirement>()
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
            val criticalTime = envelope.clampInterpolate(criticalPos)
            zoneRequirements.add(routingZoneRequirement(rawInfra, zonePath, criticalTime))
        }
        res.add(RoutingRequirement(
            rawInfra.getRouteName(route),
            routeSetDeadline,
            zoneRequirements,
        ))
    }
    return res
}

/** Create a zone requirement, which embeds all needed properties for conflict detection */
private fun routingZoneRequirement(rawInfra: RawInfra, zonePath: ZonePathId, endTime: Double): RoutingZoneRequirement {
    val zoneName = rawInfra.getZoneName(rawInfra.getNextZone(rawInfra.getZonePathEntry(zonePath))!!)
    val zoneEntry = rawInfra.getZonePathEntry(zonePath)
    val zoneExit = rawInfra.getZonePathExit(zonePath)
    val resSwitches = mutableMapOf<String, String>()
    val switches = rawInfra.getZonePathMovableElements(zonePath)
    val switchConfigs = rawInfra.getZonePathMovableElementsConfigs(zonePath)
    for ((switch, config) in switches zip switchConfigs)
        resSwitches[rawInfra.getTrackNodeName(switch)] = rawInfra.getTrackNodeConfigName(switch, config)
    return RoutingZoneRequirement(
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

fun EnvelopeTimeInterpolate.clampInterpolate(position: Distance): Double {
    val criticalPos = position.meters
    if (criticalPos <= 0.0)
        return 0.0
    if (criticalPos >= endPos)
        return totalTime

    // find when the train meets the critical location
    return interpolateTotalTime(criticalPos)
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
    data class ZoneOccupation(val entry: Double, val exit: Double)
    val zoneOccupancies = zoneOccupationChangeEvents.groupBy { it.zone }.mapValues { (_, events) ->
        assert(events.size <= 2)
        assert(events[0].isEntry)
        assert(events.size == 1 || !events[1].isEntry)
        val entryTime = events.first().time / 1000.0
        val exitTime = if (events.size == 1) envelope.totalTime else events.last().time / 1000.0
        ZoneOccupation(entryTime, exitTime)
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


    val zoneRequirementTimes = DoubleArray(zoneCount) { Double.POSITIVE_INFINITY }

    for (pathSignal in pathSignals) {
        val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
        val sightOffset = max(0.0, (pathSignal.pathOffset - rawInfra.getSignalSightDistance(physicalSignal)).meters)
        val sightTime = envelope.interpolateTotalTime(sightOffset)

        val signalZoneOffset =
            blockPath.take(pathSignal.minBlockPathIndex + 1).sumOf { blockInfra.getBlockPath(it).size }

        val zoneStates = ArrayList<ZoneStatus>(zoneCount)
        for (i in 0 until zoneCount) zoneStates.add(ZoneStatus.CLEAR)

        var lastConstrainingZone = -1
        for (i in signalZoneOffset until zoneCount) {
            zoneStates[i] = ZoneStatus.OCCUPIED
            val simulatedSignalStates = simulator.evaluate(
                rawInfra, loadedSignalInfra, blockInfra,
                blockPath, 0, blockPath.size,
                zoneStates, ZoneStatus.CLEAR
            )
            zoneStates[i] = ZoneStatus.CLEAR
            val signalState = simulatedSignalStates[pathSignal.signal]!!

            // FIXME: Have a better way to check if the signal is constraining
            if (signalState.getEnum("aspect") == "VL")
                break
            lastConstrainingZone = i
        }

        if (lastConstrainingZone == -1) {
            logger.error { "signal ${rawInfra.getLogicalSignalName(pathSignal.signal)} does not react to zone occupation" }
            continue
        }

        for (zoneIndex in signalZoneOffset .. lastConstrainingZone) {
            val prevRequiredTime = zoneRequirementTimes[zoneIndex]
            zoneRequirementTimes[zoneIndex] = min(sightTime, prevRequiredTime)
        }
    }

    /*
    For all zones which either occupied by the train or required at some point, emit a zone requirement.
    Some zones do not have requirements: those before the train's starting position, and those far enough from
    the end of the train path.

                  zone occupied                   Y           Y
      explicit zone requirement                               Y         Y
         zone needs requirement                   Y           Y         Y
                        signals           ┎o         ┎o         ┎o         ┎o         ┎o         ┎o
                          zones   +----------|----------|----------|----------|----------|----------|
                     train path                   =============
                          phase     headroom    begin      main        end          tailroom
    */

    var phase = SpacingRequirementPhase.HeadRoom
    for (zoneIndex in 0 until zoneCount) {
        val zoneRequirementTime = zoneRequirementTimes[zoneIndex]
        val zone = zoneMap[zoneIndex]
        val zoneOccupancy = zoneOccupancies[zone]

        val explicitRequirement = zoneRequirementTime.isFinite()
        val occupied = zoneOccupancy != null

        phase = phase.react(occupied, explicitRequirement)
        val correctPhase = phase.check(occupied, explicitRequirement)
        if (!correctPhase)
            logger.error { "incorrect phase for zone $zoneIndex" }

        if (phase == SpacingRequirementPhase.HeadRoom || phase == SpacingRequirementPhase.TailRoom)
            continue

        var beginTime: Double
        var endTime: Double

        val zoneName = rawInfra.getZoneName(zone)

        when (phase) {
            SpacingRequirementPhase.Begin -> {
                beginTime = 0.0
                endTime = zoneOccupancy!!.exit
            }
            SpacingRequirementPhase.Main -> {
                beginTime = if (zoneRequirementTime.isFinite()) {
                    zoneRequirementTime
                } else {
                    // zones may not be required due to faulty signaling.
                    // in this case, fall back to the time at which the zone was first occupied
                    logger.error { "missing main phase zone requirement on zone $zoneName" }
                    zoneOccupancy!!.entry
                }
                endTime = zoneOccupancy!!.exit
            }
            else -> /* SpacingRequirementPhase.End */ {
                assert(zoneRequirementTime.isFinite())
                beginTime = zoneRequirementTime
                endTime = envelope.totalTime
            }
        }

        res.add(SpacingRequirement(zoneName, beginTime, endTime))
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
            continue
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
    var currentOffset = -startOffset
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

data class PathSignal(
    val signal: LogicalSignalId,
    val pathOffset: Distance,
    // when a signal is between blocks, these two values will be different.
    // for distant signals, minBlockPath index will be one less than maxBlockPathIndex
    val minBlockPathIndex: Int,
    val maxBlockPathIndex: Int,
)


// Returns all the signals on the path
fun pathSignals(
    startOffset: Distance,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    rawInfra: SimInfraAdapter
): List<PathSignal> {
    val pathSignals = mutableListOf<PathSignal>()
    var currentOffset = -startOffset
    for ((blockIdx, block) in blockPath.withIndex()) {
        var blockSize = Distance.ZERO
        for (zonePath in blockInfra.getBlockPath(block)) {
            blockSize += rawInfra.getZonePathLength(zonePath)
        }

        val blockSignals = blockInfra.getBlockSignals(block)
        val blockSignalPositions = blockInfra.getSignalsPositions(block)
        for (signalIndex in 0 until blockSignals.size) {
            // as consecutive blocks share a signal, skip the first signal of each block, except the first
            // this way, each signal is only iterated on once
            if (signalIndex == 0 && blockIdx != 0)
                continue
            val signal = blockSignals[signalIndex]
            val position = blockSignalPositions[signalIndex]
            val dedupedSignal = blockIdx != blockPath.size - 1 && signalIndex == blockSignals.size - 1
            val maxBlockPathIndex = if (dedupedSignal) blockIdx + 1 else blockIdx
            pathSignals.add(PathSignal(signal, currentOffset + position, blockIdx, maxBlockPathIndex))
        }
        currentOffset += blockSize
    }

    return pathSignals
}


// This doesn't generate path signals outside the envelope
// The reason being that even if a train see a red signal, it won't
// matter since the train was going to stop before it anyway
private fun pathSignalsInEnvelope(
    startOffset: Distance,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    envelope: EnvelopeTimeInterpolate,
    rawInfra: SimInfraAdapter
): List<PathSignal> {
    return pathSignals(startOffset, blockPath, blockInfra, rawInfra).filter { signal ->
        signal.pathOffset >= 0.meters && signal.pathOffset <= envelope.endPos.meters
    }
}

/**
 * Computes the offset between the beginning of the first block and the beginning of the train path - and
 * thus of the envelope
 */
fun trainPathBlockOffset(trainPath: TrainPath): Distance {
    val dist = -trainPath.routePath.first().pathOffset.meters
    assert(dist >= 0.meters)
    return dist
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
