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
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.IND
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulator
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulatorImpl
import fr.sncf.osrd.envelope_sim.etcs.EoaType
import fr.sncf.osrd.path.interfaces.BlockPath
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.path.interfaces.getLegacyBlockPath
import fr.sncf.osrd.path.interfaces.getLegacyChunkPath
import fr.sncf.osrd.path.interfaces.getLegacyRoutePath
import fr.sncf.osrd.path.interfaces.getZonePathAbsolutePathEnd
import fr.sncf.osrd.signaling.SigSystemManager
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.standalone_sim.result.ResultPosition
import fr.sncf.osrd.standalone_sim.result.ResultSpeed
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
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

/** Use an already computed envelope to extract various metadata about a trip. */
fun runScheduleMetadataExtractor(
    envelope: Envelope,
    trainPath: TrainPath,
    fullInfra: FullInfra,
    rollingStock: RollingStock,
    schedule: List<SimulationScheduleItem>,
    pathItemPositions: List<Offset<TravelledPath>>,
    context: EnvelopeSimContext? = null,
): CompleteReportTrain {
    assert(envelope.continuous)

    val legacyStops =
        schedule
            .filter { it.stopFor != null }
            .map { TrainStop(it.pathOffset.meters, it.stopFor!!.seconds, it.receptionSignal) }

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
    // TODO path migration: remove this convertor (and this whole block).
    //  That requires migrating IncrementalPath.
    val startOffset =
        trainPathBlockOffset(
                rawInfra,
                blockInfra,
                trainPath.getLegacyBlockPath(),
                trainPath.getLegacyChunkPath(),
            )
            .distance
    val pathOffsetBuilder = PathOffsetBuilder(startOffset)
    var blockPathLength = 0.meters
    for (block in trainPath.getLegacyBlockPath()) blockPathLength +=
        blockInfra.getBlockLength(block).distance
    val endOffset = blockPathLength - startOffset - (envelope.endPos - envelope.beginPos).meters

    val pathSignals = pathSignalsInEnvelope(trainPath, blockInfra, envelopeWithStops)
    val zoneOccupationChangeEvents =
        zoneOccupationChangeEvents(trainPath, envelopeWithStops, trainLength)

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
            // TODO path migration: remove this weird conversion once IncrementalPath is migrated
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
            envelopeWithStops.interpolateArrivalAt(signalCriticalOffset.meters).seconds

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
                envelopeWithStops.interpolateDepartureFrom(closedSignalStopOffset.meters).seconds
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
            trainPath.getLegacyRoutePath(),
            trainPath.getLegacyBlockPath(),
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
            fullInfra,
            trainPath,
            closedSignalStops,
            envelopeWithStops,
            context,
            rollingStock,
        )
    val reportTrain =
        makeSimpleReportTrain(envelope, trainPath, rollingStock, schedule, pathItemPositions)
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
            .map { TrainStop(it.pathOffset.meters, it.stopFor!!.seconds, it.receptionSignal) }
    val envelopeStopWrapper = EnvelopeStopWrapper(envelope, stops)

    val pathItemTimes =
        pathItemPositions.map { position: Offset<TravelledPath> ->
            TimeDelta.fromSeconds(envelopeStopWrapper.interpolateArrivalAt(position.meters))
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

fun routingRequirements(
    pathOffsetBuilder: PathOffsetBuilder,
    fullInfra: FullInfra,
    trainPath: TrainPath,
    sortedClosedSignalStops: List<PathStop>,
    envelope: EnvelopeInterpolate,
    // TODO: Required for ETCS (STDCM doesn't provide it currently, will have to eventually)
    context: EnvelopeSimContext?,
    rollingStock: RollingStock,
): List<RoutingRequirement> {
    val rawInfra = fullInfra.rawInfra
    val blockInfra = fullInfra.blockInfra

    val blockRanges = trainPath.getBlocks()

    // compute the signaling train state for each signal
    data class SignalingTrainStateImpl(override val speed: Speed) : SignalingTrainState

    val signalingTrainStates = mutableMapOf<LogicalSignalId, SignalingTrainState>()
    for (blockRange in blockRanges) {
        val block = blockRange.value
        val signals = blockInfra.getBlockSignals(block)
        val signalPositions = blockInfra.getSignalsPositions(block)
        val consideredSignals =
            if (blockInfra.blockStopAtBufferStop(block)) signals.size else signals.size - 1
        for (signalIndex in 0 until consideredSignals) {
            val signal = signals[signalIndex]
            val signalOffset = signalPositions[signalIndex]
            val signalPathOffset = blockRange.offsetToTrainPath(signalOffset)
            val sightDistance = rawInfra.getSignalSightDistance(rawInfra.getPhysicalSignal(signal))
            val sightOffset = Offset.max(Offset.zero(), signalPathOffset - sightDistance)
            if (sightOffset >= blockRange.pathEnd) {
                val state = SignalingTrainStateImpl(speed = 0.0.metersPerSecond)
                signalingTrainStates[signal] = state
                continue
            }
            val maxSpeed =
                envelope
                    .maxSpeedInRange(sightOffset.meters, blockRange.pathEnd.meters)
                    .metersPerSecond
            val state = SignalingTrainStateImpl(speed = maxSpeed)
            signalingTrainStates[signal] = state
        }
    }

    fun findRouteSetDeadline(routeRange: RouteRange): TimeDelta? {
        if (routeRange.pathBegin == Offset.zero<TrainPath>()) {
            // TODO: this isn't quite true when the path starts with a stop
            //  Actually, there should be no routing requirement at all on the first route (when
            //  the train doesn't see any route entry signal). But the implications are weird and
            //  counterintuitive.
            return TimeDelta.ZERO
        }

        val firstBlockRange =
            trainPath
                .getBlocks()
                .withIndex()
                .first { it.value.pathBegin >= routeRange.pathBegin }
                .value

        // find the entry signal for this route. if there is no entry signal,
        // the set deadline is the start of the simulation
        if (blockInfra.blockStartAtBufferStop(firstBlockRange.value)) return TimeDelta.ZERO
        val etcsSimulator = context?.let { ETCSBrakingSimulatorImpl(it) }

        val singleEnvelope = envelope.rawEnvelopeIfSingle
        assert(singleEnvelope != null) {
            "A single envelope covering whole path is currently expected (used only through standalone simulation)"
        }

        val routeCriticalPos =
            getRouteCriticalPos(
                fullInfra,
                trainPath,
                firstBlockRange,
                signalingTrainStates,
                singleEnvelope!!,
                etcsSimulator,
            )

        if (routeCriticalPos == null) return null

        var routeCriticalTime = envelope.interpolateArrivalAtClamp(routeCriticalPos.meters).seconds

        // check if an arrival on stop signal is scheduled between the route critical position and
        // the entry signal of the route (both position and time, as there is a time margin) in this
        // case, just move the route critical position to the stop
        val entrySignalOffset =
            firstBlockRange.offsetToTrainPath(
                blockInfra.getSignalsPositions(firstBlockRange.value).first()
            )
        for (stop in sortedClosedSignalStops.reversed()) {
            val stopTravelledOffset = pathOffsetBuilder.toTravelledPath(stop.pathOffset)
            if (stopTravelledOffset <= entrySignalOffset) {
                // stop duration is included in interpolateDepartureFromClamp()
                val stopDepartureTime =
                    envelope.interpolateDepartureFromClamp(stopTravelledOffset.meters).seconds
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
    // for all routes, generate requirements
    for (routeRange in trainPath.getRoutes()) {
        // start out by figuring out when the route needs to be set
        // when the route is set, signaling can allow the train to proceed
        val routeSetDeadline = findRouteSetDeadline(routeRange) ?: continue

        // find the release time of the last zone of each release group
        val route = routeRange.value
        val routeZonePath = rawInfra.getRoutePath(route)
        val zoneRanges = routeRange.mapSubObject(routeZonePath, rawInfra::getZonePathLength)
        val zoneRequirements = mutableListOf<RoutingZoneRequirement>()
        for (zoneRange in zoneRanges) {
            val zonePath = zoneRange.value
            // the distance to the end of the zone from the start of the train path
            val zoneEndOffset = zoneRange.getZonePathAbsolutePathEnd(rawInfra)
            // the point in the train path at which the zone is released
            val exitCriticalPos = zoneEndOffset + rollingStock.length.meters
            // if the zones are never occupied by the train, no requirement is emitted
            // Note: the train is considered starting from a "portal", so "growing" from its start
            // offset
            if (zoneEndOffset < Offset.zero()) {
                assert(routeRange.pathBegin == Offset.zero<TrainPath>())
                continue
            }
            val exitCriticalTime =
                envelope.interpolateDepartureFromClamp(exitCriticalPos.meters).seconds
            zoneRequirements.add(routingZoneRequirement(rawInfra, zonePath, exitCriticalTime))
        }
        res.add(RoutingRequirement(route, routeSetDeadline.seconds, zoneRequirements))
    }
    return res
}

private fun getRouteCriticalPos(
    fullInfra: FullInfra,
    trainPath: TrainPath,
    firstBlockRange: BlockRange,
    signalingTrainStates: Map<LogicalSignalId, SignalingTrainState>,
    envelope: Envelope,
    etcsSimulator: ETCSBrakingSimulator?,
): Offset<TravelledPath>? {
    val blockInfra = fullInfra.blockInfra
    val simulator = fullInfra.signalingSimulator

    val sigSystemId = blockInfra.getBlockSignalingSystem(firstBlockRange.value)
    val isCurveBased = simulator.sigModuleManager.isCurveBased(sigSystemId)
    return if (isCurveBased) {
        if (
            simulator.sigModuleManager.getName(sigSystemId) != ETCS_LEVEL2.id ||
                etcsSimulator == null
        ) {
            TODO(
                "Routing requirements for curve-based signals are only available for " +
                    "ETCS_LEVEL2 and through StandaloneSimulation"
            )
        }
        getEtcsRouteCriticalPos(blockInfra, firstBlockRange, envelope, etcsSimulator)
    } else {
        getSightRouteCriticalPos(fullInfra, trainPath, firstBlockRange, signalingTrainStates)
    }
}

private fun getEtcsRouteCriticalPos(
    blockInfra: BlockInfra,
    firstBlockRange: BlockRange,
    envelope: Envelope,
    etcsSimulator: ETCSBrakingSimulator,
): Offset<TravelledPath> {

    // The braking curve targets the entry signal of the route's first block
    val signalOffset =
        firstBlockRange.offsetToTrainPath(
            blockInfra.getSignalsPositions(firstBlockRange.value).first()
        )

    val eoa =
        etcsSimulator
            .computeEoaLocations(
                envelope,
                listOf(signalOffset),
                listOf(true), // always routeDelimiter at the start of a route
                EoaType.ROUTING,
            )
            .first()
    val curvesList = etcsSimulator.computeStopBrakingCurves(envelope, listOf(eoa))

    assert(curvesList.size == 1)
    val reqPos =
        if (curvesList[eoa]!![IND] != null) {
            curvesList[eoa]!![IND]!!.brakingCurve.beginPos.meters
        } else {
            eoa.offsetEOA.distance
        }

    return Offset(reqPos)
}

private fun getSightRouteCriticalPos(
    fullInfra: FullInfra,
    trainPath: TrainPath,
    firstBlockRange: BlockRange,
    signalingTrainStates: Map<LogicalSignalId, SignalingTrainState>,
): Offset<TravelledPath>? {
    val simulator = fullInfra.signalingSimulator
    val rawInfra = fullInfra.rawInfra
    val loadedSignalInfra = fullInfra.loadedSignalInfra
    val blockInfra = fullInfra.blockInfra

    // simulate signaling on the train's path with all zones free,
    // until the start of the route, which is INCOMPATIBLE
    val zoneCount = trainPath.getZoneRanges().size
    val zoneStates = MutableList(zoneCount) { ZoneStatus.CLEAR }

    // We only want the path up to the route offset of the given route
    val subTrainPath =
        trainPath.subPath(Offset.zero(), firstBlockRange.getObjectAbsolutePathStart())

    // TODO: the complexity of finding route set deadlines is currently n^2 of the
    //   number of blocks in the path. it can be improved upon by only simulating blocks
    //   which can contain the route's limiting signal
    val simulatedSignalStates =
        simulator.evaluate(
            rawInfra,
            loadedSignalInfra,
            blockInfra,
            subTrainPath,
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
            subTrainPath,
            signalingTrainStates,
        ) ?: return null
    val limitingBlockRange = subTrainPath.getBlocks()[limitingSignalSpec.blockIndex]
    val signal =
        blockInfra.getBlockSignals(limitingBlockRange.value)[limitingSignalSpec.signalIndex]
    val limitingSignalOffsetInBlock =
        blockInfra.getSignalsPositions(limitingBlockRange.value)[limitingSignalSpec.signalIndex]

    val signalSightDistance = rawInfra.getSignalSightDistance(rawInfra.getPhysicalSignal(signal))

    // find the location at which establishing the route becomes necessary
    return limitingBlockRange.offsetToTrainPath(limitingSignalOffsetInBlock - signalSightDistance)
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
    trainPath: TrainPath,
    signalingTrainStates: Map<LogicalSignalId, SignalingTrainState>,
): LimitingSignal? {
    var lastSignalBlockIndex = -1
    var lastSignalIndex = -1
    for ((curBlockIndex, blockRange) in trainPath.getBlocks().withIndex().reversed()) {
        if (blockRange.isSinglePoint()) continue
        val curBlock = blockRange.value
        val blockSignals = blockInfra.getBlockSignals(curBlock)
        val blockSignalOffsets = blockInfra.getSignalsPositions(curBlock)
        val signalIndexStart = if (curBlockIndex == 0) 0 else 1
        for (curSignalIndex in (signalIndexStart until blockSignals.size).reversed()) {
            val signal = blockSignals[curSignalIndex]

            // ignore unseen signals before the start of the travelled path
            val signalTravelledOffset =
                blockRange.offsetToTrainPath(blockSignalOffsets[curSignalIndex])
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
    if (lastSignalBlockIndex == -1) return null
    return LimitingSignal(lastSignalBlockIndex, lastSignalIndex)
}

data class ZoneOccupationChangeEvent(
    val time: TimeDelta,
    val offset: Offset<TravelledPath>,
    val isEntry: Boolean,
    val zone: ZoneId,
)

fun zoneOccupationChangeEvents(
    trainPath: TrainPath,
    envelope: EnvelopeTimeInterpolate,
    trainLength: Distance,
): MutableList<ZoneOccupationChangeEvent> {
    val zoneOccupationChangeEvents = mutableListOf<ZoneOccupationChangeEvent>()
    for (zoneRange in trainPath.getZoneRanges()) {
        val entryOffset = zoneRange.pathBegin
        val exitOffset = zoneRange.pathEnd + trainLength
        val entryTime = envelope.interpolateArrivalAtClamp(entryOffset.meters).seconds
        val exitTime = envelope.interpolateDepartureFromClamp(exitOffset.meters).seconds

        // Avoid generating entry + exit at the same time
        if (exitTime <= entryTime) continue

        zoneOccupationChangeEvents.add(
            ZoneOccupationChangeEvent(entryTime, entryOffset, isEntry = true, zoneRange.value)
        )
        zoneOccupationChangeEvents.add(
            ZoneOccupationChangeEvent(exitTime, exitOffset, isEntry = false, zoneRange.value)
        )
    }
    zoneOccupationChangeEvents.sortBy { it.time }

    return zoneOccupationChangeEvents
}

data class PathSignal(
    val signal: LogicalSignalId,
    val pathOffset: Offset<TravelledPath>,
    // when a signal is between blocks, prefer the index of the first block
    val minBlockPathIndex: Int,
)

// Returns all the signals on the path
fun pathSignals(trainPath: TrainPath, blockInfra: BlockInfra): List<PathSignal> {
    val pathSignals = mutableListOf<PathSignal>()
    for ((blockIndex, blockRange) in trainPath.getBlocks().withIndex()) {
        val block = blockRange.value
        val blockSignals = blockInfra.getBlockSignals(block)
        val blockSignalPositions = blockInfra.getSignalsPositions(block)
        for (signalIndex in 0 until blockSignals.size) {
            // As consecutive blocks share a signal, skip the first signal of each block, except the
            // first. This way, each signal is only iterated on once
            if (signalIndex == 0 && blockIndex != 0) continue
            val signal = blockSignals[signalIndex]
            val position = blockSignalPositions[signalIndex]
            pathSignals.add(PathSignal(signal, blockRange.offsetToTrainPath(position), blockIndex))
        }
    }
    return pathSignals
}

// This doesn't generate path signals outside the envelope
// The reason being that even if a train see a red signal, it won't
// matter since the train was going to stop before it anyway
fun pathSignalsInEnvelope(
    trainPath: TrainPath,
    blockInfra: BlockInfra,
    envelope: EnvelopeTimeInterpolate,
): List<PathSignal> {
    return pathSignalsInRange(trainPath, blockInfra, 0.meters, envelope.endPos.meters)
}

fun pathSignalsInRange(
    trainPath: TrainPath,
    blockInfra: BlockInfra,
    rangeStart: Distance,
    rangeEnd: Distance,
): List<PathSignal> {
    return pathSignals(trainPath, blockInfra).filter { signal ->
        signal.pathOffset.distance in rangeStart..rangeEnd
    }
}
