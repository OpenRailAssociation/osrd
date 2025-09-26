package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.standalone_sim.CompleteReportTrain
import fr.sncf.osrd.api.standalone_sim.ReportTrain
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.conflicts.RoutingRequirement.RoutingZoneRequirement
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeInterpolate
import fr.sncf.osrd.envelope.EnvelopePhysics
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.path.interfaces.BlockPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.signaling.SigSystemManager
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.routesOnBlock
import fr.sncf.osrd.standalone_sim.result.ResultPosition
import fr.sncf.osrd.standalone_sim.result.ResultSpeed
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.simplifyEnvelopePoints
import fr.sncf.osrd.utils.trainPathBlockOffset
import fr.sncf.osrd.utils.units.*

// Reserve clear track with a margin for the reaction time of the driver
const val CLOSED_SIGNAL_RESERVATION_MARGIN = 20.0

// the start offset is the distance from the start of the first block to the start location
class PathOffsetBuilder(val startOffset: Distance) {
    fun toTravelledPath(offset: Offset<BlockPath>): Offset<TravelledPath> {
        return Offset(offset.distance - startOffset)
    }

    fun fromTravelledPath(offset: Offset<TravelledPath>): Offset<BlockPath> {
        return Offset(offset.distance + startOffset)
    }
}

// For a path (sequence of blocks and matching sequence of routes)
// Wrap information about a block, to be used in a lookup table (sorted by block index in
// block-path).
private data class BlockInfo(
    val block: BlockId,
    // the index of the route in the path
    val routeIndex: Int,
)

private fun buildBlockInfoTable(
    blockInfra: BlockInfra,
    rawInfra: RawInfra,
    routePath: StaticIdxList<Route>,
    blockPath: StaticIdxList<Block>,
): List<BlockInfo> {
    val detailedBlocks = mutableListOf<BlockInfo>()

    var currentRouteIdx = 0

    for (blockId in blockPath) {

        val blockRoutes = blockInfra.routesOnBlock(rawInfra, blockId)
        if (!blockRoutes.contains(routePath[currentRouteIdx])) {
            currentRouteIdx++
        }
        assert(currentRouteIdx < routePath.size)
        val routeId = routePath[currentRouteIdx]
        assert(blockRoutes.contains(routeId))

        val element = BlockInfo(blockId, currentRouteIdx)
        detailedBlocks.add(element)
    }

    return detailedBlocks
}

/** Use an already computed envelope to extract various metadata about a trip. */
fun runScheduleMetadataExtractor(
    envelope: Envelope,
    trainPath: TrainPath,
    chunkPath: ChunkPath,
    fullInfra: FullInfra,
    routePath: StaticIdxList<Route>,
    blockPath: StaticIdxList<Block>,
    rollingStock: RollingStock,
    schedule: List<SimulationScheduleItem>,
    pathItemPositions: List<Offset<TravelledPath>>,
    context: EnvelopeSimContext? = null,
): CompleteReportTrain {
    assert(envelope.continuous)

    val legacyStops =
        schedule
            .filter { it.stopFor != null }
            .map {
                TrainStop(it.pathOffset.distance.meters, it.stopFor!!.seconds, it.receptionSignal)
            }

    val rawInfra = fullInfra.rawInfra
    val loadedSignalInfra = fullInfra.loadedSignalInfra
    val blockInfra = fullInfra.blockInfra
    val simulator = fullInfra.signalingSimulator

    // Compute speeds, head and tail positions
    val envelopeWithStops = EnvelopeStopWrapper(envelope, legacyStops)
    val trainLength = rollingStock.length.meters
    val speeds = ArrayList<ResultSpeed>()
    val headPositions = ArrayList<ResultPosition>()
    for (point in envelopeWithStops.iteratePoints()) {
        speeds.add(ResultSpeed(point.time, point.speed, point.position))
        headPositions.add(ResultPosition.from(point.time, point.position, trainPath, rawInfra))
    }

    // Compute signal updates
    val startOffset = trainPathBlockOffset(rawInfra, blockInfra, blockPath, chunkPath).distance
    val pathOffsetBuilder = PathOffsetBuilder(startOffset)
    var blockPathLength = 0.meters
    for (block in blockPath) blockPathLength += blockInfra.getBlockLength(block).distance
    val endOffset = blockPathLength - startOffset - (envelope.endPos - envelope.beginPos).meters

    val pathSignals =
        pathSignalsInEnvelope(pathOffsetBuilder, blockPath, blockInfra, envelopeWithStops)
    val zoneOccupationChangeEvents =
        zoneOccupationChangeEvents(
            pathOffsetBuilder,
            blockPath,
            blockInfra,
            envelopeWithStops,
            rawInfra,
            trainLength,
        )

    val zoneUpdates =
        zoneOccupationChangeEvents.map {
            ZoneUpdate(rawInfra.getZoneName(it.zone), it.time, it.offset, it.isEntry)
        }

    val pathStops =
        schedule.map {
            PathStop(pathOffsetBuilder.fromTravelledPath(it.pathOffset), it.receptionSignal)
        }
    val fragmentStops =
        pathStops.map {
            // All blocks are in the fragment, Offset<Path> == Offset<FragmentBlocks> here
            val fragmentOffset = it.pathOffset.cast<FragmentBlocks>()
            FragmentStop(fragmentOffset, it.receptionSignal)
        }
    val closedSignalStops = pathStops.filter { it.receptionSignal.isStopOnClosedSignal }

    val signalCriticalPositions = mutableListOf<SignalCriticalPosition>()
    var indexClosedSignalStop = 0

    var closedSignalStopOffset =
        getStopTravelledPathOffset(closedSignalStops, indexClosedSignalStop, pathOffsetBuilder)
    for ((indexPathSignal, pathSignal) in pathSignals.withIndex()) {
        val sigSystemId = loadedSignalInfra.getSignalingSystem(pathSignal.signal)
        if (simulator.sigModuleManager.isCurveBased(sigSystemId)) {
            // no on-sight green block in space-time chart (VL requirement) for curve-based signals
            continue
        }

        val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
        var signalCriticalOffset =
            Offset.max(
                Offset.zero(),
                pathSignal.pathOffset - rawInfra.getSignalSightDistance(physicalSignal),
            )
        if (indexPathSignal > 0) {
            val previousSignalOffset = pathSignals[indexPathSignal - 1].pathOffset
            signalCriticalOffset = Offset.max(signalCriticalOffset, previousSignalOffset)
        }
        var signalCriticalTime =
            envelopeWithStops.interpolateArrivalAt(signalCriticalOffset.distance.meters).seconds

        // advance to the first stop after sightOffset
        while (closedSignalStopOffset != null && closedSignalStopOffset <= signalCriticalOffset) {
            closedSignalStopOffset =
                getStopTravelledPathOffset(
                    closedSignalStops,
                    indexClosedSignalStop++,
                    pathOffsetBuilder,
                )
        }
        // if stop is before signal
        if (closedSignalStopOffset != null && closedSignalStopOffset <= pathSignal.pathOffset) {
            // advance to the last stop before signal
            var nextStopOffset =
                getStopTravelledPathOffset(
                    closedSignalStops,
                    indexClosedSignalStop + 1,
                    pathOffsetBuilder,
                )
            while (nextStopOffset != null && nextStopOffset <= pathSignal.pathOffset) {
                closedSignalStopOffset = nextStopOffset
                indexClosedSignalStop++
                nextStopOffset =
                    getStopTravelledPathOffset(
                        closedSignalStops,
                        indexClosedSignalStop + 1,
                        pathOffsetBuilder,
                    )
            }

            val stopDepartureTime =
                envelopeWithStops
                    .interpolateDepartureFrom(closedSignalStopOffset.distance.meters)
                    .seconds
            if (signalCriticalTime < stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN.seconds) {
                signalCriticalOffset = closedSignalStopOffset
                signalCriticalTime = stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN.seconds
            }
        }

        signalCriticalPositions.add(
            SignalCriticalPosition(
                rawInfra.getPhysicalSignalName(
                    loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
                )!!,
                maxOf(signalCriticalTime, TimeDelta.ZERO),
                signalCriticalOffset,
                "VL", // TODO: find out the real state
            )
        )
    }

    val incrementalPath = incrementalPathOf(rawInfra, blockInfra)
    val envelopeAdapter =
        IncrementalRequirementEnvelopeAdapter(rollingStock, envelopeWithStops, true)
    val spacingGenerator =
        SpacingRequirementAutomaton(
            rawInfra,
            loadedSignalInfra,
            blockInfra,
            simulator,
            envelopeAdapter,
            incrementalPath,
            context,
        )
    incrementalPath.extend(
        PathFragment(
            routePath,
            blockPath,
            fragmentStops,
            containsStart = true,
            containsEnd = true,
            startOffset,
            endOffset,
        )
    )
    // as the provided path is complete, the resource generator should never return NotEnoughPath
    val spacingRequirements = spacingGenerator.processPathUpdate() as SpacingRequirements

    val routingRequirements =
        routingRequirements(
            pathOffsetBuilder,
            simulator,
            routePath,
            blockPath,
            closedSignalStops,
            loadedSignalInfra,
            blockInfra,
            envelopeWithStops,
            rawInfra,
            rollingStock,
        )
    val reportTrain =
        makeSimpleReportTrain(
            fullInfra,
            envelope,
            trainPath,
            rollingStock,
            schedule,
            pathItemPositions,
        )
    return CompleteReportTrain(
        reportTrain.positions,
        reportTrain.times,
        reportTrain.speeds,
        reportTrain.energyConsumption,
        reportTrain.pathItemTimes,
        signalCriticalPositions,
        zoneUpdates,
        spacingRequirements.requirements.map { it.toRJS(rawInfra) },
        routingRequirements.map { it.toRJS(rawInfra) },
    )
}

fun getStopTravelledPathOffset(
    pathStops: List<PathStop>,
    indexStop: Int,
    pathOffsetBuilder: PathOffsetBuilder,
): Offset<TravelledPath>? {
    val stop = pathStops.getOrNull(indexStop) ?: return null
    return pathOffsetBuilder.toTravelledPath(stop.pathOffset)
}

fun makeSimpleReportTrain(
    envelope: Envelope,
    trainPath: TrainPath,
    rollingStock: RollingStock,
    schedule: List<SimulationScheduleItem>,
    pathItemPositions: List<Offset<TravelledPath>>,
): ReportTrain {
    // Compute energy consumed
    val mechanicalEnergyConsumed =
        EnvelopePhysics.getMechanicalEnergyConsumed(envelope, trainPath, rollingStock)

    // Account for stop durations
    val stops =
        schedule
            .filter { it.stopFor != null }
            .map {
                TrainStop(it.pathOffset.distance.meters, it.stopFor!!.seconds, it.receptionSignal)
            }
    val envelopeStopWrapper = EnvelopeStopWrapper(envelope, stops)

    val pathItemTimes =
        pathItemPositions.map { position: Offset<TravelledPath> ->
            TimeDelta.fromSeconds(
                envelopeStopWrapper.interpolateArrivalAt(position.distance.meters)
            )
        }

    // Iterate over the points and simplify the results
    val points = envelopeStopWrapper.iteratePoints()
    // Speed and time scalings are arbitrary values adapted from previously used tolerances.
    val simplified = simplifyEnvelopePoints(points, 5.0, 0.2)
    assert(simplified.isNotEmpty()) { "simulation result shouldn't be empty" }

    return ReportTrain(
        simplified.map { Offset(it.position.meters) },
        simplified.map { it.time.seconds },
        simplified.map { it.speed },
        mechanicalEnergyConsumed,
        pathItemTimes,
    )
}

fun getBlockOffsets(
    blockPath: StaticIdxList<Block>,
    pathOffsetBuilder: PathOffsetBuilder,
    blockInfra: BlockInfra,
): OffsetArray<TravelledPath> {
    val blockOffsets = MutableOffsetArray(blockPath.size) { Offset.zero<TravelledPath>() }
    var curOffset = Offset.zero<BlockPath>()
    for (i in 0 until blockPath.size) {
        blockOffsets[i] = pathOffsetBuilder.toTravelledPath(curOffset)
        val blockLength = blockInfra.getBlockLength(blockPath[i])
        curOffset += blockLength.distance
    }
    return blockOffsets.immutableCopyOf()
}

fun routingRequirements(
    pathOffsetBuilder: PathOffsetBuilder,
    simulator: SignalingSimulator,
    routePath: StaticIdxList<Route>,
    blockPath: StaticIdxList<Block>,
    sortedClosedSignalStops: List<PathStop>,
    loadedSignalInfra: LoadedSignalInfra,
    blockInfra: BlockInfra,
    envelope: EnvelopeInterpolate,
    rawInfra: RawInfra,
    rollingStock: RollingStock,
): List<RoutingRequirement> {
    // count the number of zones in the path
    val zoneCount = routePath.sumOf { rawInfra.getRoutePath(it).size }

    // recover blocks info from the route and block paths into a lookup table
    val blockInfoTable = buildBlockInfoTable(blockInfra, rawInfra, routePath, blockPath)

    // fill a lookup table mapping route indices to the index of the route's first block
    val routeBlockBounds = IntArray(routePath.size + 1)
    var lastRoute = -1
    for (blockIndex in blockInfoTable.indices) {
        val block = blockInfoTable[blockIndex]
        if (block.routeIndex == lastRoute) continue
        lastRoute = block.routeIndex
        routeBlockBounds[lastRoute] = blockIndex
    }
    routeBlockBounds[routePath.size] = blockInfoTable.size

    val blockOffsets = getBlockOffsets(blockPath, pathOffsetBuilder, blockInfra)

    // compute the signaling train state for each signal
    data class SignalingTrainStateImpl(override val speed: Speed) : SignalingTrainState

    val signalingTrainStates = mutableMapOf<LogicalSignalId, SignalingTrainState>()
    for (i in 0 until blockPath.size) {
        val block = blockPath[i]
        val blockOffset = blockOffsets[i]
        val blockEndOffset =
            Offset.min(
                Offset(envelope.endPos.meters),
                blockOffset + blockInfra.getBlockLength(block).distance,
            )
        val signals = blockInfra.getBlockSignals(blockPath[i])
        val consideredSignals =
            if (blockInfra.blockStopAtBufferStop(block)) signals.size else signals.size - 1
        for (signalIndex in 0 until consideredSignals) {
            val signal = signals[signalIndex]
            val signalOffset = blockInfra.getSignalsPositions(block)[signalIndex].distance
            val signalPathOffset = blockOffset + signalOffset
            val sightDistance = rawInfra.getSignalSightDistance(rawInfra.getPhysicalSignal(signal))
            val sightOffset = Offset.max(Offset.zero(), signalPathOffset - sightDistance)
            if (sightOffset >= blockEndOffset) {
                val state = SignalingTrainStateImpl(speed = 0.0.metersPerSecond)
                signalingTrainStates[signal] = state
                continue
            }
            val maxSpeed =
                envelope
                    .maxSpeedInRange(sightOffset.distance.meters, blockEndOffset.distance.meters)
                    .metersPerSecond
            val state = SignalingTrainStateImpl(speed = maxSpeed)
            signalingTrainStates[signal] = state
        }
    }

    fun findRouteSetDeadline(routeIndex: Int): TimeDelta? {
        if (routeIndex == 0) {
            // TODO: this isn't quite true when the path starts with a stop
            return TimeDelta.ZERO
        }

        // find the first block of the route
        val routeStartBlockIndex = routeBlockBounds[routeIndex]
        val firstRouteBlock = blockInfoTable[routeStartBlockIndex].block

        // find the entry signal for this route. if there is no entry signal,
        // the set deadline is the start of the simulation
        if (blockInfra.blockStartAtBufferStop(firstRouteBlock)) return TimeDelta.ZERO

        // simulate signaling on the train's path with all zones free,
        // until the start of the route, which is INCOMPATIBLE
        val zoneStates = mutableListOf<ZoneStatus>()
        for (i in 0 until zoneCount) zoneStates.add(ZoneStatus.CLEAR)

        // TODO: the complexity of finding route set deadlines is currently n^2 of the number of
        //   blocks in the path. it can be improved upon by only simulating blocks which can
        //   contain the route's limiting signal
        val simulatedSignalStates =
            simulator.evaluate(
                rawInfra,
                loadedSignalInfra,
                blockInfra,
                blockPath,
                routePath.toList(),
                routeStartBlockIndex,
                zoneStates,
                ZoneStatus.INCOMPATIBLE,
            )

        // find the first non-open signal on the path
        // iterate backwards on blocks from blockIndex to 0, and on signals
        val limitingSignalSpec =
            findLimitingSignal(
                loadedSignalInfra,
                blockInfra,
                simulator.sigModuleManager,
                simulatedSignalStates,
                blockPath,
                blockOffsets,
                routeStartBlockIndex,
                signalingTrainStates,
            ) ?: return null
        val limitingBlock = blockPath[limitingSignalSpec.blockIndex]
        val signal = blockInfra.getBlockSignals(limitingBlock)[limitingSignalSpec.signalIndex]
        val limitingSignalOffsetInBlock =
            blockInfra.getSignalsPositions(limitingBlock)[limitingSignalSpec.signalIndex].distance

        val limitingBlockOffset = blockOffsets[limitingSignalSpec.blockIndex]
        val signalSightDistance =
            rawInfra.getSignalSightDistance(rawInfra.getPhysicalSignal(signal))

        // find the location at which establishing the route becomes necessary
        val routeCriticalPos =
            limitingBlockOffset + limitingSignalOffsetInBlock - signalSightDistance
        var routeCriticalTime =
            envelope.interpolateArrivalAtClamp(routeCriticalPos.distance.meters).seconds

        // check if an arrival on stop signal is scheduled between the route critical position and
        // the entry signal of the route (both position and time, as there is a time margin) in this
        // case, just move the route critical position to the stop
        val entrySignalOffset =
            blockOffsets[routeStartBlockIndex] +
                blockInfra.getSignalsPositions(firstRouteBlock).first().distance
        for (stop in sortedClosedSignalStops.reversed()) {
            val stopTravelledOffset = pathOffsetBuilder.toTravelledPath(stop.pathOffset)
            if (stopTravelledOffset <= entrySignalOffset) {
                // stop duration is included in interpolateDepartureFromClamp()
                val stopDepartureTime =
                    envelope
                        .interpolateDepartureFromClamp(stopTravelledOffset.distance.meters)
                        .seconds
                if (
                    routeCriticalTime < stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN.seconds
                ) {
                    routeCriticalTime = stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN.seconds
                }
                break
            }
        }

        return maxOf(routeCriticalTime, TimeDelta.ZERO)
    }

    val res = mutableListOf<RoutingRequirement>()
    var routePathOffset = Offset.zero<BlockPath>()
    // for all routes, generate requirements
    for (routeIndex in 0 until routePath.size) {
        // start out by figuring out when the route needs to be set
        // when the route is set, signaling can allow the train to proceed
        val routeSetDeadline = findRouteSetDeadline(routeIndex) ?: continue

        // find the release time of the last zone of each release group
        val route = routePath[routeIndex]
        val routeZonePath = rawInfra.getRoutePath(route)
        val zoneRequirements = mutableListOf<RoutingZoneRequirement>()
        for (zonePathIndex in 0 until routeZonePath.size) {
            val zonePath = routeZonePath[zonePathIndex]
            routePathOffset += rawInfra.getZonePathLength(zonePath).distance
            // the distance to the end of the zone from the start of the train path
            val travelPathOffset = pathOffsetBuilder.toTravelledPath(routePathOffset)
            // the point in the train path at which the zone is released
            val exitCriticalPos = travelPathOffset + rollingStock.length.meters
            // if the zones are never occupied by the train, no requirement is emitted
            // Note: the train is considered starting from a "portal", so "growing" from its start
            // offset
            if (travelPathOffset < Offset.zero()) {
                assert(routeIndex == 0)
                continue
            }
            val exitCriticalTime =
                envelope.interpolateDepartureFromClamp(exitCriticalPos.distance.meters).seconds
            zoneRequirements.add(routingZoneRequirement(rawInfra, zonePath, exitCriticalTime))
        }
        res.add(RoutingRequirement(route, routeSetDeadline.seconds, zoneRequirements))
    }
    return res
}

/** Create a zone requirement, which embeds all needed properties for conflict detection */
private fun routingZoneRequirement(
    rawInfra: RawInfra,
    zonePath: ZonePathId,
    endTime: TimeDelta,
): RoutingZoneRequirement {
    val zone = rawInfra.getNextZone(rawInfra.getZonePathEntry(zonePath))!!
    val zoneEntry = rawInfra.getZonePathEntry(zonePath)
    val zoneExit = rawInfra.getZonePathExit(zonePath)
    val resSwitches = mutableMapOf<String, String>()
    val switches = rawInfra.getZonePathMovableElements(zonePath)
    val switchConfigs = rawInfra.getZonePathMovableElementsConfigs(zonePath)
    for ((switch, config) in switches zip switchConfigs) resSwitches[
        rawInfra.getTrackNodeName(switch)] = rawInfra.getTrackNodeConfigName(switch, config)
    return RoutingZoneRequirement(zone, zoneEntry, zoneExit, resSwitches, endTime.seconds)
}

data class LimitingSignal(val blockIndex: Int, val signalIndex: Int)

/**
 * For any given train path, each route must be set prior to the train reaching some location. This
 * location is the point at which the driver first sees the first signal to incur a slowdown. This
 * signal is the limiting signal.
 */
private fun findLimitingSignal(
    loadedSignalInfra: LoadedSignalInfra,
    blockInfra: BlockInfra,
    sigSystemManager: SigSystemManager,
    simulatedSignalStates: Map<LogicalSignalId, SigState>,
    blockPath: StaticIdxList<Block>,
    blockOffsets: OffsetArray<TravelledPath>,
    routeStartBlockIndex: Int,
    signalingTrainStates: Map<LogicalSignalId, SignalingTrainState>,
): LimitingSignal? {
    var lastSignalBlockIndex = -1
    var lastSignalIndex = -1
    for (curBlockIndex in (0 until routeStartBlockIndex).reversed()) {
        val curBlock = blockPath[curBlockIndex]
        val blockSignals = blockInfra.getBlockSignals(curBlock)
        val signalIndexStart = if (curBlockIndex == 0) 0 else 1
        for (curSignalIndex in (signalIndexStart until blockSignals.size).reversed()) {
            val signal = blockSignals[curSignalIndex]

            // ignore unseen signals before the start of the travelled path
            val signalTravelledOffset =
                blockOffsets[curBlockIndex] +
                    blockInfra.getSignalsPositions(curBlock)[curSignalIndex].distance
            if (signalTravelledOffset < Offset.zero()) break

            val ssid = loadedSignalInfra.getSignalingSystem(signal)
            val signalState = simulatedSignalStates[signal]!!
            val trainState = signalingTrainStates[signal]!!
            if (!sigSystemManager.isConstraining(ssid, signalState, trainState)) break
            lastSignalBlockIndex = curBlockIndex
            lastSignalIndex = curSignalIndex
        }
    }
    // Limiting signal not found
    if (lastSignalBlockIndex == -1 || lastSignalIndex == -1) return null
    return LimitingSignal(lastSignalBlockIndex, lastSignalIndex)
}

data class ZoneOccupationChangeEvent(
    val time: TimeDelta,
    val offset: Offset<TravelledPath>,
    val zoneIndexInPath: Int,
    val isEntry: Boolean,
    val blockIdx: Int,
    val zone: ZoneId,
)

fun zoneOccupationChangeEvents(
    pathOffsetBuilder: PathOffsetBuilder,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    envelope: EnvelopeTimeInterpolate,
    rawInfra: RawInfra,
    trainLength: Distance,
): MutableList<ZoneOccupationChangeEvent> {
    var zoneCount = 0
    var currentOffset = pathOffsetBuilder.toTravelledPath(Offset.zero())
    val zoneOccupationChangeEvents = mutableListOf<ZoneOccupationChangeEvent>()
    for ((blockIdx, block) in blockPath.withIndex()) {
        for (zonePath in blockInfra.getBlockZonePaths(block)) {
            // Compute occupation change event
            if (currentOffset.distance > envelope.endPos.meters) break
            val entryOffset = Offset.max(Offset.zero(), currentOffset)
            val entryTime =
                envelope.interpolateArrivalAtUS(entryOffset.distance.meters).microseconds
            val zone = rawInfra.getNextZone(rawInfra.getZonePathEntry(zonePath))!!
            zoneOccupationChangeEvents.add(
                ZoneOccupationChangeEvent(entryTime, entryOffset, zoneCount, true, blockIdx, zone)
            )
            currentOffset += rawInfra.getZonePathLength(zonePath).distance
            if (currentOffset.distance > envelope.endPos.meters) {
                zoneCount++
                break
            }
            val exitOffset = Offset.max(Offset.zero(), currentOffset + trainLength)
            if (exitOffset.distance <= envelope.endPos.meters) {
                val exitTime =
                    envelope.interpolateDepartureFromUS(exitOffset.distance.meters).microseconds
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
    val pathOffset: Offset<TravelledPath>,
    // when a signal is between blocks, prefer the index of the first block
    val minBlockPathIndex: Int,
)

// Returns all the signals on the path
fun pathSignals(
    pathOffsetBuilder: PathOffsetBuilder,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
): List<PathSignal> {
    val pathSignals = mutableListOf<PathSignal>()
    var currentOffset = pathOffsetBuilder.toTravelledPath(Offset.zero())
    for ((blockIdx, block) in blockPath.withIndex()) {
        val blockSignals = blockInfra.getBlockSignals(block)
        val blockSignalPositions = blockInfra.getSignalsPositions(block)
        for (signalIndex in 0 until blockSignals.size) {
            // as consecutive blocks share a signal, skip the first signal of each block, except the
            // first
            // this way, each signal is only iterated on once
            if (signalIndex == 0 && blockIdx != 0) continue
            val signal = blockSignals[signalIndex]
            val position = blockSignalPositions[signalIndex].distance
            pathSignals.add(PathSignal(signal, currentOffset + position, blockIdx))
        }
        currentOffset += blockInfra.getBlockLength(block).distance
    }
    return pathSignals
}

// This doesn't generate path signals outside the envelope
// The reason being that even if a train see a red signal, it won't
// matter since the train was going to stop before it anyway
fun pathSignalsInEnvelope(
    pathOffsetBuilder: PathOffsetBuilder,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    envelope: EnvelopeTimeInterpolate,
): List<PathSignal> {
    return pathSignalsInRange(
        pathOffsetBuilder,
        blockPath,
        blockInfra,
        0.meters,
        envelope.endPos.meters,
    )
}

fun pathSignalsInRange(
    pathOffsetBuilder: PathOffsetBuilder,
    blockPath: StaticIdxList<Block>,
    blockInfra: BlockInfra,
    rangeStart: Distance,
    rangeEnd: Distance,
): List<PathSignal> {
    return pathSignals(pathOffsetBuilder, blockPath, blockInfra).filter { signal ->
        signal.pathOffset.distance in rangeStart..rangeEnd
    }
}
