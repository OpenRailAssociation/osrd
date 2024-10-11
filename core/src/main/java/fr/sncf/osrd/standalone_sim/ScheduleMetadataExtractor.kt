@file:JvmName("ScheduleMetadataExtractor")

package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeInterpolate
import fr.sncf.osrd.envelope.EnvelopePhysics
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.SigSystemManager
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.utils.BlockPathElement
import fr.sncf.osrd.sim_infra.utils.chunksToRoutes
import fr.sncf.osrd.sim_infra.utils.recoverBlocks
import fr.sncf.osrd.sim_infra.utils.toList
import fr.sncf.osrd.standalone_sim.result.ResultPosition
import fr.sncf.osrd.standalone_sim.result.ResultSpeed
import fr.sncf.osrd.standalone_sim.result.ResultStops
import fr.sncf.osrd.standalone_sim.result.ResultTrain
import fr.sncf.osrd.standalone_sim.result.ResultTrain.RoutingRequirement
import fr.sncf.osrd.standalone_sim.result.ResultTrain.RoutingZoneRequirement
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SignalSighting
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.StandaloneTrainSchedule
import fr.sncf.osrd.utils.CurveSimplification
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.*
import kotlin.collections.set
import kotlin.math.abs
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

// Reserve clear track with a margin for the reaction time of the driver
const val CLOSED_SIGNAL_RESERVATION_MARGIN = 20.0

// the start offset is the distance from the start of the first block to the start location
class PathOffsetBuilder(val startOffset: Distance) {
    fun toTravelledPath(offset: Offset<Path>): Offset<TravelledPath> {
        return Offset(offset.distance - startOffset)
    }

    fun fromTravelledPath(offset: Offset<TravelledPath>): Offset<Path> {
        return Offset(offset.distance + startOffset)
    }
}

fun recoverBlockPath(
    simulator: SignalingSimulator,
    fullInfra: FullInfra,
    routePath: StaticIdxList<Route>,
): List<BlockPathElement> {
    // TODO: the allowed signaling systems should depend on the type of train
    val sigSystemManager = simulator.sigModuleManager
    val bal = sigSystemManager.findSignalingSystemOrThrow("BAL")
    val bapr = sigSystemManager.findSignalingSystemOrThrow("BAPR")
    val tvm300 = sigSystemManager.findSignalingSystemOrThrow("TVM300")
    val tvm430 = sigSystemManager.findSignalingSystemOrThrow("TVM430")

    val blockPaths =
        recoverBlocks(
            fullInfra.rawInfra,
            fullInfra.blockInfra,
            routePath,
            mutableStaticIdxArrayListOf(bal, bapr, tvm300, tvm430)
        )
    assert(blockPaths.isNotEmpty())
    return blockPaths[0].toList() // TODO: have a better way to choose the block path
}

/** Use an already computed envelope to extract various metadata about a trip. */
fun run(
    envelope: Envelope,
    trainPath: PathProperties,
    chunkPath: ChunkPath,
    schedule: StandaloneTrainSchedule,
    fullInfra: FullInfra
): ResultTrain {
    assert(envelope.continuous)

    val rawInfra = fullInfra.rawInfra
    val loadedSignalInfra = fullInfra.loadedSignalInfra
    val blockInfra = fullInfra.blockInfra
    val simulator = fullInfra.signalingSimulator

    // get a new generation route path
    val routePath = fullInfra.blockInfra.chunksToRoutes(rawInfra, chunkPath.chunks)

    // recover blocks from the route paths
    val detailedBlockPath = recoverBlockPath(simulator, fullInfra, routePath)
    val blockPath = mutableStaticIdxArrayListOf<Block>()
    for (block in detailedBlockPath) blockPath.add(block.block)

    // Compute speeds, head and tail positions
    val envelopeWithStops = EnvelopeStopWrapper(envelope, schedule.stops)
    val trainLength = schedule.rollingStock.length
    var speeds = ArrayList<ResultSpeed>()
    var headPositions = ArrayList<ResultPosition>()
    for (point in envelopeWithStops.iteratePoints()) {
        speeds.add(ResultSpeed(point.time, point.speed, point.position))
        headPositions.add(ResultPosition.from(point.time, point.position, trainPath, rawInfra))
    }

    // Simplify data
    speeds = simplifySpeeds(speeds)
    headPositions = simplifyPositions(headPositions)

    // Compute stops
    val stops = ArrayList<ResultStops>()
    for (stop in schedule.stops) {
        val stopTime = envelopeWithStops.interpolateArrivalAt(stop.position)
        stops.add(ResultStops(stopTime, stop.position, stop.duration))
    }

    // Compute signal updates
    val startOffset = trainPathBlockOffset(rawInfra, blockInfra, blockPath, chunkPath)
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
            trainLength
        )

    val zoneUpdates =
        zoneOccupationChangeEvents.map {
            ResultTrain.ZoneUpdate(
                rawInfra.getZoneName(it.zone),
                it.time.seconds,
                it.offset.distance.meters,
                it.isEntry
            )
        }

    val signalSightings = mutableListOf<SignalSighting>()
    for ((i, pathSignal) in pathSignals.withIndex()) {
        val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
        var sightOffset =
            Offset.max(
                Offset.zero(),
                pathSignal.pathOffset - rawInfra.getSignalSightDistance(physicalSignal)
            )
        if (i > 0) {
            val previousSignalOffset = pathSignals[i - 1].pathOffset
            sightOffset = Offset.max(sightOffset, previousSignalOffset)
        }
        signalSightings.add(
            SignalSighting(
                rawInfra.getPhysicalSignalName(
                    loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
                ),
                envelopeWithStops.interpolateArrivalAt(sightOffset.distance.meters),
                sightOffset.distance.meters,
                "VL" // TODO: find out the real state
            )
        )
    }

    // Compute energy consumed
    val envelopePath = EnvelopeTrainPath.from(fullInfra.rawInfra, trainPath)
    val mechanicalEnergyConsumed =
        EnvelopePhysics.getMechanicalEnergyConsumed(envelope, envelopePath, schedule.rollingStock)

    val incrementalPath = incrementalPathOf(rawInfra, blockInfra)
    val envelopeAdapter =
        IncrementalRequirementEnvelopeAdapter(schedule.rollingStock, envelopeWithStops, true)
    val spacingGenerator =
        SpacingRequirementAutomaton(
            rawInfra,
            loadedSignalInfra,
            blockInfra,
            simulator,
            envelopeAdapter,
            incrementalPath
        )
    val pathStops =
        schedule.stops.map {
            PathStop(
                pathOffsetBuilder.fromTravelledPath(Offset(it.position.meters)),
                it.receptionSignal
            )
        }
    incrementalPath.extend(
        PathFragment(
            routePath,
            blockPath,
            pathStops,
            containsStart = true,
            containsEnd = true,
            startOffset,
            endOffset
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
            detailedBlockPath,
            pathStops.filter { it.receptionSignal.isStopOnClosedSignal },
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
        mechanicalEnergyConsumed,
        signalSightings,
        zoneUpdates,
        spacingRequirements.requirements,
        routingRequirements,
    )
}

fun getBlockOffsets(
    blockPath: StaticIdxList<Block>,
    pathOffsetBuilder: PathOffsetBuilder,
    blockInfra: BlockInfra
): OffsetArray<TravelledPath> {
    val blockOffsets = MutableOffsetArray(blockPath.size) { Offset.zero<TravelledPath>() }
    var curOffset = Offset.zero<Path>()
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
    detailedBlockPath: List<BlockPathElement>,
    sortedClosedSignalStops: List<PathStop>,
    loadedSignalInfra: LoadedSignalInfra,
    blockInfra: BlockInfra,
    envelope: EnvelopeInterpolate,
    rawInfra: RawInfra,
    rollingStock: RollingStock,
): List<RoutingRequirement> {
    // count the number of zones in the path
    val zoneCount = routePath.sumOf { rawInfra.getRoutePath(it).size }

    // fill a lookup table mapping route indices to the index of the route's first block
    val routeBlockBounds = IntArray(routePath.size + 1)
    var lastRoute = -1
    for (blockIndex in detailedBlockPath.indices) {
        val block = detailedBlockPath[blockIndex]
        if (block.routeIndex == lastRoute) continue
        lastRoute = block.routeIndex
        routeBlockBounds[lastRoute] = blockIndex
    }
    routeBlockBounds[routePath.size] = detailedBlockPath.size

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
                blockOffset + blockInfra.getBlockLength(block).distance
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

    fun findRouteSetDeadline(routeIndex: Int): Double? {
        if (routeIndex == 0)
        // TODO: this isn't quite true when the path starts with a stop
        return 0.0

        // find the first block of the route
        val routeStartBlockIndex = routeBlockBounds[routeIndex]
        val firstRouteBlock = detailedBlockPath[routeStartBlockIndex].block

        // find the entry signal for this route. if there is no entry signal,
        // the set deadline is the start of the simulation
        if (blockInfra.blockStartAtBufferStop(firstRouteBlock)) return 0.0

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
                ZoneStatus.INCOMPATIBLE
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
                signalingTrainStates
            ) ?: return null
        val limitingBlock = blockPath[limitingSignalSpec.blockIndex]
        val signal = blockInfra.getBlockSignals(limitingBlock)[limitingSignalSpec.signalIndex]
        val limitingSignalOffsetInBlock =
            blockInfra.getSignalsPositions(limitingBlock)[limitingSignalSpec.signalIndex].distance

        val limitingBlockOffset = blockOffsets[limitingSignalSpec.blockIndex]
        val signalSightDistance =
            rawInfra.getSignalSightDistance(rawInfra.getPhysicalSignal(signal))

        // find the location at which establishing the route becomes necessary
        val criticalPos = limitingBlockOffset + limitingSignalOffsetInBlock - signalSightDistance
        var criticalTime = envelope.interpolateArrivalAtClamp(criticalPos.distance.meters)

        // check if an arrival on stop signal is scheduled between the critical position and the
        // entry signal of the route (both position and time, as there is a time margin)
        // in this case, just move the critical position to just after the stop
        val entrySignalOffset =
            blockOffsets[routeStartBlockIndex] +
                blockInfra.getSignalsPositions(firstRouteBlock).first().distance
        for (stop in sortedClosedSignalStops.reversed()) {
            val stopTravelledOffset = pathOffsetBuilder.toTravelledPath(stop.pathOffset)
            if (stopTravelledOffset <= entrySignalOffset) {
                // stop duration is included in interpolateDepartureFromClamp()
                val stopDepartureTime =
                    envelope.interpolateDepartureFromClamp(stopTravelledOffset.distance.meters)
                if (criticalTime < stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN) {
                    criticalTime = stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN
                }
                break
            }
        }

        return maxOf(criticalTime, 0.0)
    }

    val res = mutableListOf<RoutingRequirement>()
    var routePathOffset = Offset.zero<Path>()
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
            val criticalPos = travelPathOffset + rollingStock.length.meters
            // if the zones are never occupied by the train, no requirement is emitted
            // Note: the train is considered starting from a "portal", so "growing" from its start
            // offset
            if (travelPathOffset < Offset.zero()) {
                assert(routeIndex == 0)
                continue
            }
            val criticalTime = envelope.interpolateDepartureFromClamp(criticalPos.distance.meters)
            zoneRequirements.add(routingZoneRequirement(rawInfra, zonePath, criticalTime))
        }
        res.add(
            RoutingRequirement(
                rawInfra.getRouteName(route),
                routeSetDeadline,
                zoneRequirements,
            )
        )
    }
    return res
}

/** Create a zone requirement, which embeds all needed properties for conflict detection */
private fun routingZoneRequirement(
    rawInfra: RawInfra,
    zonePath: ZonePathId,
    endTime: Double
): RoutingZoneRequirement {
    val zoneName = rawInfra.getZoneName(rawInfra.getNextZone(rawInfra.getZonePathEntry(zonePath))!!)
    val zoneEntry = rawInfra.getZonePathEntry(zonePath)
    val zoneExit = rawInfra.getZonePathExit(zonePath)
    val resSwitches = mutableMapOf<String, String>()
    val switches = rawInfra.getZonePathMovableElements(zonePath)
    val switchConfigs = rawInfra.getZonePathMovableElementsConfigs(zonePath)
    for ((switch, config) in switches zip switchConfigs) resSwitches[
        rawInfra.getTrackNodeName(switch)] = rawInfra.getTrackNodeConfigName(switch, config)
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
    signalingTrainStates: Map<LogicalSignalId, SignalingTrainState>
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
    trainLength: Double
): MutableList<ZoneOccupationChangeEvent> {
    var zoneCount = 0
    var currentOffset = pathOffsetBuilder.toTravelledPath(Offset.zero())
    val zoneOccupationChangeEvents = mutableListOf<ZoneOccupationChangeEvent>()
    for ((blockIdx, block) in blockPath.withIndex()) {
        for (zonePath in blockInfra.getBlockPath(block)) {
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
            val exitOffset = Offset.max(Offset.zero(), currentOffset + trainLength.meters)
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
        envelope.endPos.meters
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

/**
 * Computes the offset between the beginning of the first block and the beginning of the train
 * path - and thus of the envelope
 */
fun trainPathBlockOffset(
    infra: RawInfra,
    blockInfra: BlockInfra,
    blockPath: StaticIdxList<Block>,
    chunkPath: ChunkPath
): Distance {
    var firstChunk = chunkPath.chunks[0]
    var prevChunksLength = 0.meters
    if (infra.getTrackChunkLength(firstChunk.value) == chunkPath.beginOffset) {
        firstChunk = chunkPath.chunks[1]
        prevChunksLength = -chunkPath.beginOffset.distance
    }
    for (block in blockPath) {
        for (zonePath in blockInfra.getBlockPath(block)) {
            for (dirChunk in infra.getZonePathChunks(zonePath)) {
                if (dirChunk == firstChunk) return prevChunksLength + chunkPath.beginOffset.distance
                prevChunksLength += infra.getTrackChunkLength(dirChunk.value).distance
            }
        }
    }
    val error = OSRDError(ErrorType.ScheduleMetadataExtractionFailed)
    error.context["reason"] = "Couldn't find first chunk on the block path"
    throw error
}

fun simplifyPositions(positions: ArrayList<ResultPosition>): ArrayList<ResultPosition> {
    return CurveSimplification.rdp(positions, 5.0) {
        point: ResultPosition,
        start: ResultPosition,
        end: ResultPosition ->
        if (abs(start.time - end.time) < 0.000001)
            return@rdp abs(point.pathOffset - start.pathOffset)
        val proj =
            start.pathOffset +
                (point.time - start.time) * (end.pathOffset - start.pathOffset) /
                    (end.time - start.time)
        abs(point.pathOffset - proj)
    }
}

fun simplifySpeeds(speeds: ArrayList<ResultSpeed>): ArrayList<ResultSpeed> {
    return CurveSimplification.rdp(speeds, 0.2) {
        point: ResultSpeed,
        start: ResultSpeed,
        end: ResultSpeed ->
        if (abs(start.position - end.position) < 0.000001) return@rdp abs(point.speed - start.speed)
        val proj =
            start.speed +
                (point.position - start.position) * (end.speed - start.speed) /
                    (end.position - start.position)
        abs(point.speed - proj)
    }
}
