package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.standalone_sim.CompleteReportTrain
import fr.sncf.osrd.api.standalone_sim.ReportTrain
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.conflicts.RoutingRequirement.RoutingZoneRequirement
import fr.sncf.osrd.conflicts.SpacingResourceGenerator
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeInterpolate
import fr.sncf.osrd.envelope.EnvelopePhysics
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.IND
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulator
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulatorImpl
import fr.sncf.osrd.envelope_sim.etcs.EoaType
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.ZoneRange
import fr.sncf.osrd.path.interfaces.getNonBacktrackingSubPathBoundariesContainingOffset
import fr.sncf.osrd.signaling.SigSystemManager
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.standalone_sim.result.ResultPosition
import fr.sncf.osrd.standalone_sim.result.ResultSpeed
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.arePositionsEqual
import fr.sncf.osrd.utils.simplifyEnvelopePoints
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.TimeDelta
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.metersPerSecond
import fr.sncf.osrd.utils.units.seconds
import kotlin.math.min

// Reserve clear track with a margin for the reaction time of the driver
const val CLOSED_SIGNAL_RESERVATION_MARGIN = 20.0

/** Use an already computed envelope to extract various metadata about a trip. */
fun runScheduleMetadataExtractor(
    envelope: Envelope,
    trainPath: TrainPath,
    fullInfra: FullInfra,
    rollingStocks: DistanceRangeMap<PhysicsRollingStock>,
    schedule: List<SimulationScheduleItem>,
    pathItemPositions: List<Offset<PhysicsPath>>,
    context: EnvelopeSimContext? = null,
): CompleteReportTrain {
    assert(envelope.continuous)

    val legacyStops =
        schedule
            .filter { it.stopFor != null }
            .map { TrainStop(it.pathOffset.meters, it.stopFor!!.seconds, it.receptionSignal) }

    val rawInfra = fullInfra.rawInfra

    // Compute speeds, head and tail positions
    val envelopeWithStops = EnvelopeStopWrapper(envelope, legacyStops)
    val speeds = ArrayList<ResultSpeed>()
    val headPositions = ArrayList<ResultPosition>()
    for (point in envelopeWithStops.iteratePoints()) {
        speeds.add(ResultSpeed(point.time, point.speed, point.position))
        headPositions.add(ResultPosition.from(point.time, point.position, trainPath, rawInfra))
    }

    val zoneOccupationChangeEvents =
        zoneOccupationChangeEvents(trainPath, envelopeWithStops, rollingStocks)

    val zoneUpdates =
        zoneOccupationChangeEvents.map {
            ZoneUpdate(rawInfra.getZoneName(it.zone), it.time, it.offset, it.isEntry)
        }

    val pathStops =
        schedule.filter { it.stopFor != null }.map { PathStop(it.pathOffset, it.receptionSignal) }
    val closedSignalStops = pathStops.filter { it.receptionSignal.isStopOnClosedSignal }

    val signalCriticalPositions =
        getSignalCriticalPositions(fullInfra, envelopeWithStops, trainPath, closedSignalStops)

    val envelopeAdapter =
        IncrementalRequirementEnvelopeAdapter(rollingStocks, envelopeWithStops, true)
    val spacingGenerator = SpacingResourceGenerator(fullInfra, context)
    spacingGenerator.extendPath(trainPath.getBlocks(), trainPath.getRoutes(), pathStops, true)
    // as the provided path is complete, the resource generator should never return NotEnoughPath
    val spacingRequirements = spacingGenerator.processUpdate(envelopeAdapter)!!

    val routingRequirements =
        routingRequirements(
            fullInfra,
            trainPath,
            closedSignalStops,
            envelopeWithStops,
            context,
            zoneOccupationChangeEvents,
            rollingStocks,
        )
    val reportTrain =
        makeSimpleReportTrain(envelope, trainPath, rollingStocks, schedule, pathItemPositions)
    return CompleteReportTrain(
        reportTrain.positions,
        reportTrain.times,
        reportTrain.speeds,
        reportTrain.energyConsumption,
        reportTrain.pathItemTimes,
        signalCriticalPositions,
        zoneUpdates,
        spacingRequirements.map { it.toRJS(rawInfra) },
        routingRequirements.map { it.toRJS(rawInfra) },
    )
}

fun getSignalCriticalPositions(
    fullInfra: FullInfra,
    envelopeWithStops: EnvelopeStopWrapper,
    trainPath: TrainPath,
    closedSignalStops: List<PathStop>,
): List<SignalCriticalPosition> {
    val rawInfra = fullInfra.rawInfra
    val loadedSignalInfra = fullInfra.loadedSignalInfra

    val pathSignals = pathSignals(trainPath, fullInfra.blockInfra)

    val signalCriticalPositions = mutableListOf<SignalCriticalPosition>()
    var indexClosedSignalStop = 0

    var closedSignalStopOffset =
        getStopTravelledPathOffset(closedSignalStops, indexClosedSignalStop)
    for ((indexPathSignal, pathSignal) in pathSignals.withIndex()) {
        val sigSystemId = loadedSignalInfra.getSignalingSystem(pathSignal.signal)
        if (fullInfra.signalingSimulator.sigModuleManager.isCurveBased(sigSystemId)) {
            // no on-sight green block in space-time chart (VL requirement) for curve-based signals
            continue
        }

        val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
        // This is OK to use signal offset as the signals strictly outside the path are removed at
        // that point
        val straightSubPathRange =
            trainPath.getNonBacktrackingSubPathBoundariesContainingOffset(pathSignal.pathOffset)
        var signalCriticalOffset =
            Offset.max(
                straightSubPathRange.start,
                pathSignal.pathOffset - rawInfra.getSignalSightDistance(physicalSignal),
            )
        if (indexPathSignal > 0) {
            val previousSignalOffset = pathSignals[indexPathSignal - 1].pathOffset
            signalCriticalOffset = Offset.max(signalCriticalOffset, previousSignalOffset)
        }
        var signalCriticalTime =
            envelopeWithStops.interpolateArrivalAt(signalCriticalOffset.meters).seconds

        // advance to the first stop after sightOffset
        while (closedSignalStopOffset != null && closedSignalStopOffset < signalCriticalOffset) {
            closedSignalStopOffset =
                getStopTravelledPathOffset(closedSignalStops, indexClosedSignalStop++)
        }
        // if stop is before signal
        if (closedSignalStopOffset != null && closedSignalStopOffset <= pathSignal.pathOffset) {
            // advance to the last stop before signal
            var nextStopOffset =
                getStopTravelledPathOffset(closedSignalStops, indexClosedSignalStop + 1)
            while (nextStopOffset != null && nextStopOffset <= pathSignal.pathOffset) {
                closedSignalStopOffset = nextStopOffset
                indexClosedSignalStop++
                nextStopOffset =
                    getStopTravelledPathOffset(closedSignalStops, indexClosedSignalStop + 1)
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
    return signalCriticalPositions
}

fun getStopTravelledPathOffset(pathStops: List<PathStop>, indexStop: Int): Offset<PhysicsPath>? {
    return pathStops.getOrNull(indexStop)?.pathOffset
}

fun makeSimpleReportTrain(
    envelope: Envelope,
    trainPath: TrainPath,
    rollingStocks: DistanceRangeMap<PhysicsRollingStock>,
    schedule: List<SimulationScheduleItem>,
    pathItemPositions: List<Offset<PhysicsPath>>,
): ReportTrain {
    // Compute energy consumed
    require(arePositionsEqual(rollingStocks.upperBound().meters, envelope.endPos))
    val mechanicalEnergyConsumed =
        EnvelopePhysics.getMechanicalEnergyConsumed(envelope, trainPath, rollingStocks)

    // Account for stop durations
    val stops =
        schedule
            .filter { it.stopFor != null }
            .map { TrainStop(it.pathOffset.meters, it.stopFor!!.seconds, it.receptionSignal) }
    val envelopeStopWrapper = EnvelopeStopWrapper(envelope, stops)

    val pathItemTimes =
        pathItemPositions.map { position: Offset<PhysicsPath> ->
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

private fun getArrivalAt(envelope: EnvelopeTimeInterpolate, offset: Offset<PhysicsPath>): Duration {
    return envelope.interpolateArrivalAtClamp(offset.meters).seconds
}

private fun getDepartureFrom(
    envelope: EnvelopeTimeInterpolate,
    offset: Offset<PhysicsPath>,
): Duration {
    return envelope.interpolateDepartureFromClamp(offset.meters).seconds
}

fun routingRequirements(
    fullInfra: FullInfra,
    trainPath: TrainPath,
    sortedClosedSignalStops: List<PathStop>,
    envelope: EnvelopeInterpolate,
    // TODO: Required for ETCS (STDCM doesn't provide it currently, will have to eventually)
    context: EnvelopeSimContext?,
    zoneOccupationChangeEvents: List<ZoneOccupationChangeEvent>,
    rollingStocks: DistanceRangeMap<PhysicsRollingStock>,
): List<RoutingRequirement> {
    return listOf()
//    val rawInfra = fullInfra.rawInfra
//    val blockInfra = fullInfra.blockInfra
//
//    val blockRanges = trainPath.getBlocks()
//
//    // compute the signaling train state for each signal
//    data class SignalingTrainStateImpl(override val speed: Speed) : SignalingTrainState
//
//    val signalingTrainStates = mutableMapOf<LogicalSignalId, SignalingTrainState>()
//    for (blockRange in blockRanges) {
//        val block = blockRange.value
//        val straightSubPathRange =
//            trainPath.getNonBacktrackingSubPathBoundariesContainingOffset(blockRange.pathBegin)
//        val signals = blockInfra.getBlockSignals(block)
//        val signalPositions = blockInfra.getSignalsPositions(block)
//        val consideredSignals =
//            if (blockInfra.blockStopAtBufferStop(block)) signals.size else signals.size - 1
//        for (signalIndex in 0 until consideredSignals) {
//            val signal = signals[signalIndex]
//            val signalOffset = signalPositions[signalIndex]
//            val signalPathOffset = blockRange.offsetToTrainPath(signalOffset)
//            val sightDistance = rawInfra.getSignalSightDistance(rawInfra.getPhysicalSignal(signal))
//            val sightOffset =
//                Offset.max(straightSubPathRange.start, signalPathOffset - sightDistance)
//            if (sightOffset >= blockRange.pathEnd) {
//                val state = SignalingTrainStateImpl(speed = 0.0.metersPerSecond)
//                signalingTrainStates[signal] = state
//                continue
//            }
//            val maxSpeed =
//                envelope
//                    .maxSpeedInRange(sightOffset.meters, blockRange.pathEnd.meters)
//                    .metersPerSecond
//            val state = SignalingTrainStateImpl(speed = maxSpeed)
//            signalingTrainStates[signal] = state
//        }
//    }
//
//    fun findRouteSetDeadline(routeRange: RouteRange): TimeDelta? {
//        val straightSubPathRange =
//            trainPath.getNonBacktrackingSubPathBoundariesContainingOffset(routeRange.pathBegin)
//        if (routeRange.pathBegin == straightSubPathRange.start) {
//            // TODO: this isn't quite true when the path starts with a stop
//            //  Actually, there should be no routing requirement at all on the first route (when
//            //  the train doesn't see any route entry signal). But the implications are weird and
//            //  counterintuitive.
//            return getDepartureFrom(envelope, straightSubPathRange.start)
//        }
//
//        val firstBlockRange =
//            trainPath
//                .getBlocks()
//                .withIndex()
//                .first { it.value.pathBegin >= routeRange.pathBegin }
//                .value
//
//        // find the entry signal for this route. if there is no entry signal,
//        // the set deadline is the start after the last backtrack
//        if (blockInfra.blockStartAtBufferStop(firstBlockRange.value))
//            return getDepartureFrom(envelope, straightSubPathRange.start)
//        val etcsSimulator = context?.let { ETCSBrakingSimulatorImpl(it) }
//
//        val singleEnvelope = envelope.rawEnvelopeIfSingle
//        assert(singleEnvelope != null) {
//            "A single envelope covering whole path is currently expected (used only through standalone simulation)"
//        }
//
//        val routeCriticalPos =
//            getRouteCriticalPos(
//                fullInfra,
//                trainPath,
//                firstBlockRange,
//                signalingTrainStates,
//                singleEnvelope!!,
//                etcsSimulator,
//            )
//
//        if (routeCriticalPos == null) return null
//
//        var routeCriticalTime = getArrivalAt(envelope, routeCriticalPos)
//
//        // check if an arrival on stop signal is scheduled between the route critical position and
//        // the entry signal of the route (both position and time, as there is a time margin) in this
//        // case, just move the route critical position to the stop
//        val entrySignalOffset =
//            Offset.max(
//                straightSubPathRange.start,
//                firstBlockRange.offsetToTrainPath(
//                    blockInfra.getSignalsPositions(firstBlockRange.value).first()
//                ),
//            )
//        for (stop in sortedClosedSignalStops.reversed()) {
//            val stopTravelledOffset = stop.pathOffset
//            if (stopTravelledOffset <= entrySignalOffset) {
//                // stop duration is included
//                val stopDepartureTime = getDepartureFrom(envelope, stopTravelledOffset)
//                if (
//                    routeCriticalTime < stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN.seconds
//                ) {
//                    routeCriticalTime = stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN.seconds
//                }
//                break
//            }
//        }
//
//        return maxOf(routeCriticalTime, getArrivalAt(envelope, straightSubPathRange.start))
//    }
//
//    val res = mutableListOf<RoutingRequirement>()
//    // for all routes, generate requirements
//    for (routeRange in trainPath.getRoutes()) {
//        // start out by figuring out when the route needs to be set
//        // when the route is set, signaling can allow the train to proceed
//        val routeSetDeadline = findRouteSetDeadline(routeRange) ?: continue
//
//        // find the release time of the last zone of each release group
//        val route = routeRange.value
//        val routeZonePath = rawInfra.getRoutePath(route)
//        val zoneRanges = routeRange.mapSubObject(routeZonePath, rawInfra::getZonePathLength)
//        val zoneRequirements = mutableListOf<RoutingZoneRequirement>()
//        for (zoneRange in zoneRanges) {
//            val zonePath = zoneRange.value
//            val zone = rawInfra.getZonePathZone(zonePath)
//
//            // if the zones are never occupied by the train, no requirement is emitted
//            // Note: the train is considered starting from a "portal", so "growing" from its start
//            // offset
//            if (zoneRange.objectAbsolutePathEnd < Offset.zero()) {
//                assert(routeRange.pathBegin == Offset.zero<TrainPath>())
//                continue
//            }
//
//            // the point in the train path at which the zone is released
//            val zoneOccupationExit =
//                zoneOccupationChangeEvents
//                    .firstOrNull {
//                        it.zone == zone && !it.isEntry && it.offset > zoneRange.pathBegin
//                    }
//                    ?.offset
//
//            if (zoneOccupationExit == null) {
//                // We never exit the zone, ignore this if we in fact never entered it.
//                require(
//                    zoneOccupationChangeEvents.none {
//                        it.isEntry &&
//                            it.zone == zone &&
//                            it.offset > zoneRange.pathBegin &&
//                            it.offset <= zoneRange.pathEnd
//                    }
//                )
//                continue
//            }
//
//            // release the "route zone" at the latest before the train restart after backtracking
//            val straightSubPathRange =
//                trainPath.getNonBacktrackingSubPathBoundariesContainingOffset(zoneRange.pathBegin)
//            val exitCriticalPos = Offset.min(zoneOccupationExit, straightSubPathRange.end)
//
//            val exitCriticalTime = getDepartureFrom(envelope, exitCriticalPos)
//            zoneRequirements.add(routingZoneRequirement(rawInfra, zonePath, exitCriticalTime))
//        }
//        res.add(RoutingRequirement(route, routeSetDeadline.seconds, zoneRequirements))
//    }
//    return res
}

private fun getRouteCriticalPos(
    fullInfra: FullInfra,
    trainPath: TrainPath,
    firstBlockRange: BlockRange,
    signalingTrainStates: Map<LogicalSignalId, SignalingTrainState>,
    envelope: Envelope,
    etcsSimulator: ETCSBrakingSimulator?,
): Offset<PhysicsPath>? {
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
        if (trainPath.getBacktrackLocations().isNotEmpty()) {
            TODO("ETCS_LEVEL2 does not handle backtracking yet")
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
): Offset<PhysicsPath> {

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
): Offset<PhysicsPath>? {
    val simulator = fullInfra.signalingSimulator
    val rawInfra = fullInfra.rawInfra
    val loadedSignalInfra = fullInfra.loadedSignalInfra
    val blockInfra = fullInfra.blockInfra

    // simulate signaling on the train's path with all zones free,
    // until the start of the route, which is INCOMPATIBLE

    // We only want the path up to the route offset of the given route
    val straightSubPathRange =
        trainPath.getNonBacktrackingSubPathBoundariesContainingOffset(firstBlockRange.pathBegin)
    val subTrainPath =
        trainPath.subPath(
            straightSubPathRange.start,
            firstBlockRange.objectAbsolutePathStart,
            includeExactStart = straightSubPathRange.start == Offset.zero<TrainPath>(),
            includeExactEnd = firstBlockRange.objectAbsolutePathStart == straightSubPathRange.end,
        )

    // TODO: the complexity of finding route set deadlines is currently n^2 of the
    //   number of blocks in the path. it can be improved upon by only simulating blocks
    //   which can contain the route's limiting signal
    val simulatedSignalStates =
        simulator.evaluate(
            rawInfra,
            loadedSignalInfra,
            blockInfra,
            subTrainPath,
            mapOf(),
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
    val subTrainPathCriticalPos =
        limitingBlockRange.offsetToTrainPath(limitingSignalOffsetInBlock - signalSightDistance)
    return straightSubPathRange.start + Distance.max(subTrainPathCriticalPos.distance, 0.meters)
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

            // ignore unseen signals before the start of the traveled path
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
    val offset: Offset<PhysicsPath>,
    val isEntry: Boolean,
    val zone: ZoneId,
)

private fun getBacktrackWithTrainTailOverOffset(
    ascendingBacktrackLocations: List<Offset<PhysicsPath>>,
    trainLength: Distance,
    offset: Offset<PhysicsPath>,
): Offset<PhysicsPath>? {
    for (backtracking in ascendingBacktrackLocations) {
        if (offset < backtracking - trainLength) continue
        if (offset <= backtracking) return backtracking
        break
    }
    return null
}

private fun zoneRangeExitOffset(
    ascendingBacktrackLocations: List<Offset<PhysicsPath>>,
    trainLength: Distance,
    zoneRange: ZoneRange,
): Offset<PhysicsPath> {
    val backtrackOverZoneBeginOffset =
        getBacktrackWithTrainTailOverOffset(
            ascendingBacktrackLocations,
            trainLength,
            zoneRange.pathBegin,
        )
    if (
        backtrackOverZoneBeginOffset != null && backtrackOverZoneBeginOffset != zoneRange.pathBegin
    ) {
        // Backtracking with tail above zone-start: entry location of the head (zone-start) will
        // actually be exit location of the tail after backtrack.
        // No matter the length of the train (> 100m in the example), if the zone started 100m
        // before backtrack, then it will end 100m after backtrack.
        return backtrackOverZoneBeginOffset + (backtrackOverZoneBeginOffset - zoneRange.pathBegin)
    }

    val backtrackOverZoneEndOffset =
        getBacktrackWithTrainTailOverOffset(
            ascendingBacktrackLocations,
            trainLength,
            zoneRange.pathEnd,
        )
    if (backtrackOverZoneEndOffset != null) {
        // Backtracking with tail above zone-end: will actually lead to occupying zone until the
        // backtracking (to be merged later with occupation after backtrack).
        return backtrackOverZoneEndOffset
    }

    // regular case: wait until tail crosses exit
    return zoneRange.pathEnd + trainLength
}

private fun sortAndMergeSameZoneOverlappingOrContiguousOccupations(
    zoneOccupationChangeEvents: MutableList<ZoneOccupationChangeEvent>
) {
    // Sorting entries before exits to "create" overlaps for contiguous occupations, then easily
    // merge those
    zoneOccupationChangeEvents.sortWith(compareBy({ it.time }, { !it.isEntry }))

    // Keeping only the events that start-from/end-to no occupation on considered zone
    val currentOccupationNumberByZone = mutableMapOf<ZoneId, Int>()
    val eventIterator = zoneOccupationChangeEvents.iterator()
    while (eventIterator.hasNext()) {
        val event = eventIterator.next()
        var updated = currentOccupationNumberByZone.getOrDefault(event.zone, 0)
        if (event.isEntry) {
            if (updated > 0) {
                // keep entry only when not already occupied before the considered entry
                eventIterator.remove()
            }
            updated++
        } else {
            updated--
            if (updated > 0) {
                // keep exit only when there are no more occupation ongoing after the considered
                // exit
                eventIterator.remove()
            }
        }
        require(updated >= 0)
        currentOccupationNumberByZone[event.zone] = updated
    }
}

fun zoneOccupationChangeEvents(
    trainPath: TrainPath,
    envelope: EnvelopeTimeInterpolate,
    rollingStocks: DistanceRangeMap<PhysicsRollingStock>,
): List<ZoneOccupationChangeEvent> {
    // Check that backtracks are sorted ascending and that there is no "backtrack-over-backtrack"
    // (in which case the following code wouldn't work properly)
    require(
        trainPath
            .getBacktrackLocations()
            .asSequence()
            .zipWithNext { current, next ->
                current < next - rollingStocks.get(next.distance)!!.length.meters
            }
            .all { it }
    )

    val zoneOccupationChangeEvents = mutableListOf<ZoneOccupationChangeEvent>()
    for (zoneRange in trainPath.getZoneRanges()) {
        // We ignore the case when the rolling stock length increases in the next zones and
        // re-enters the current zone
        val trainLengthAtExit = rollingStocks.get(zoneRange.pathEnd.distance)!!.length.meters
        // entry is always at the start of the zone (might lead to some adjacent identical zone
        // occupation for the same zone at backtrack)
        val entryOffset = zoneRange.pathBegin
        val entryTime = getArrivalAt(envelope, entryOffset)

        val exitOffset =
            zoneRangeExitOffset(trainPath.getBacktrackLocations(), trainLengthAtExit, zoneRange)
        val exitTime = getDepartureFrom(envelope, exitOffset)

        // Avoid generating entry + exit at the same time
        if (exitTime <= entryTime) continue
        zoneOccupationChangeEvents.add(
            ZoneOccupationChangeEvent(entryTime, entryOffset, isEntry = true, zoneRange.value)
        )
        zoneOccupationChangeEvents.add(
            ZoneOccupationChangeEvent(exitTime, exitOffset, isEntry = false, zoneRange.value)
        )
    }

    sortAndMergeSameZoneOverlappingOrContiguousOccupations(zoneOccupationChangeEvents)

    return zoneOccupationChangeEvents
}

data class PathSignal(
    val signal: LogicalSignalId,
    val pathOffset: Offset<PhysicsPath>,
    // when a signal is between blocks, prefer the index of the first block
    val minBlockPathIndex: Int,
)

// Returns all the signals on the path
// This doesn't generate path signals outside the trainPath (exclude signals before
// or after any straight sub-path between start, backtracking locations and end).
// The reason being that:
// - train doesn't see signals before the (re-)start of the head
// - even if a train sees a red signal after the end, it won't matter since the
//   train was going to stop before it anyway.
fun pathSignals(trainPath: TrainPath, blockInfra: BlockInfra): List<PathSignal> {
    val pathSignals = mutableListOf<PathSignal>()
    for ((blockIndex, blockRange) in trainPath.getBlocks().withIndex()) {
        val block = blockRange.value
        val straightSubPathRange =
            trainPath.getNonBacktrackingSubPathBoundariesContainingOffset(blockRange.pathBegin)
        val blockSignals = blockInfra.getBlockSignals(block)
        val blockSignalPositions = blockInfra.getSignalsPositions(block)
        for (signalIndex in 0 until blockSignals.size) {
            // As consecutive blocks share a signal, skip the first signal of each block, except the
            // first ones of each straight sub-path. This way, each signal is only iterated on once
            if (
                signalIndex == 0 &&
                    !(blockRange.pathBegin == Offset<PhysicsPath>(0.meters) ||
                        blockRange.pathBegin in trainPath.getBacktrackLocations())
            )
                continue
            val signal = blockSignals[signalIndex]
            val pathOffset = blockRange.offsetToTrainPath(blockSignalPositions[signalIndex])

            if (pathOffset in straightSubPathRange.start..straightSubPathRange.end) {
                pathSignals.add(PathSignal(signal, pathOffset, blockIndex))
            }
        }
    }
    return pathSignals
}
