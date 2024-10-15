package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.*
import fr.sncf.osrd.api.api_v2.standalone_sim.CompleteReportTrain
import fr.sncf.osrd.api.api_v2.standalone_sim.ReportTrain
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopePhysics
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.standalone_sim.result.ResultPosition
import fr.sncf.osrd.standalone_sim.result.ResultSpeed
import fr.sncf.osrd.standalone_sim.result.ResultStops
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.CurveSimplification
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.*
import kotlin.math.abs

/** Use an already computed envelope to extract various metadata about a trip. */
fun runScheduleMetadataExtractor(
    envelope: Envelope,
    trainPath: PathProperties,
    chunkPath: ChunkPath,
    fullInfra: FullInfra,
    routePath: StaticIdxList<Route>,
    rollingStock: RollingStock,
    schedule: List<SimulationScheduleItem>,
    pathItemPositions: List<Offset<Path>>,
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

    // get a new generation route path

    // recover blocks from the route paths
    val detailedBlockPath = recoverBlockPath(simulator, fullInfra, routePath)
    val blockPath = mutableStaticIdxArrayListOf<Block>()
    for (block in detailedBlockPath) blockPath.add(block.block)

    // Compute speeds, head and tail positions
    val envelopeWithStops = EnvelopeStopWrapper(envelope, legacyStops)
    val trainLength = rollingStock.length
    val speeds = ArrayList<ResultSpeed>()
    val headPositions = ArrayList<ResultPosition>()
    for (point in envelopeWithStops.iteratePoints()) {
        speeds.add(ResultSpeed(point.time, point.speed, point.position))
        headPositions.add(ResultPosition.from(point.time, point.position, trainPath, rawInfra))
    }

    // Compute stops
    val stops = ArrayList<ResultStops>()
    for (stop in legacyStops) {
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
            ZoneUpdate(rawInfra.getZoneName(it.zone), it.time, it.offset, it.isEntry)
        }

    val pathStops =
        schedule.map {
            PathStop(pathOffsetBuilder.fromTravelledPath(it.pathOffset), it.receptionSignal)
        }
    val closedSignalStops = pathStops.filter { it.receptionSignal.isStopOnClosedSignal }

    val signalCriticalPositions =
        getSignalCriticalPositions(
            closedSignalStops,
            pathOffsetBuilder,
            pathSignals,
            fullInfra,
            envelopeWithStops
        )

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
            incrementalPath
        )
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
            signalCriticalPositions.associateBy { it.signal },
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
            pathItemPositions
        )
    return CompleteReportTrain(
        reportTrain.positions,
        reportTrain.times,
        reportTrain.speeds,
        reportTrain.energyConsumption,
        reportTrain.pathItemTimes,
        signalCriticalPositions,
        zoneUpdates,
        spacingRequirements.requirements.map {
            SpacingRequirement(it.zone, it.beginTime.seconds, it.endTime.seconds)
        },
        routingRequirements.map {
            RoutingRequirement(
                it.route,
                it.beginTime.seconds,
                it.zones.map { req ->
                    RoutingZoneRequirement(
                        req.zone,
                        req.entryDetector,
                        req.exitDetector,
                        req.switches,
                        req.endTime.seconds
                    )
                }
            )
        }
    )
}

private fun getSignalCriticalPositions(
    closedSignalStops: List<PathStop>,
    pathOffsetBuilder: PathOffsetBuilder,
    pathSignals: List<PathSignal>,
    fullInfra: FullInfra,
    envelopeWithStops: EnvelopeStopWrapper
): MutableList<SignalSighting> {
    val signalCriticalPositions = mutableListOf<SignalSighting>()
    var indexClosedSignalStop = 0

    var closedSignalStopOffset =
        getStopTravelledPathOffset(closedSignalStops, indexClosedSignalStop, pathOffsetBuilder)
    for ((indexPathSignal, pathSignal) in pathSignals.withIndex()) {
        val physicalSignal = fullInfra.loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
        var criticalOffset =
            Offset.max(
                Offset.zero(),
                pathSignal.pathOffset - fullInfra.rawInfra.getSignalSightDistance(physicalSignal)
            )
        if (indexPathSignal > 0) {
            val previousSignalOffset = pathSignals[indexPathSignal - 1].pathOffset
            criticalOffset = Offset.max(criticalOffset, previousSignalOffset)
        }
        var criticalTime = envelopeWithStops.interpolateArrivalAt(criticalOffset.distance.meters)

        // advance to the first stop after sightOffset
        while (closedSignalStopOffset != null && closedSignalStopOffset <= criticalOffset) {
            closedSignalStopOffset =
                getStopTravelledPathOffset(
                    closedSignalStops,
                    indexClosedSignalStop++,
                    pathOffsetBuilder
                )
        }
        // if stop is before signal
        if (closedSignalStopOffset != null && closedSignalStopOffset <= pathSignal.pathOffset) {
            // advance to the last stop before signal
            var nextStopOffset =
                getStopTravelledPathOffset(
                    closedSignalStops,
                    indexClosedSignalStop + 1,
                    pathOffsetBuilder
                )
            while (nextStopOffset != null && nextStopOffset <= pathSignal.pathOffset) {
                closedSignalStopOffset = nextStopOffset
                indexClosedSignalStop++
                nextStopOffset =
                    getStopTravelledPathOffset(
                        closedSignalStops,
                        indexClosedSignalStop + 1,
                        pathOffsetBuilder
                    )
            }

            val stopDepartureTime =
                envelopeWithStops.interpolateDepartureFrom(criticalOffset.distance.meters)
            if (criticalTime < stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN) {
                criticalOffset = closedSignalStopOffset!!
                criticalTime = stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN
            }
        }

        signalCriticalPositions.add(
            SignalSighting(
                fullInfra.rawInfra.getPhysicalSignalName(
                    fullInfra.loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
                )!!,
                maxOf(criticalTime.seconds, Duration.ZERO),
                criticalOffset,
                "VL" // TODO: find out the real state
            )
        )
    }
    return signalCriticalPositions
}

fun getStopTravelledPathOffset(
    pathStops: List<PathStop>,
    indexStop: Int,
    pathOffsetBuilder: PathOffsetBuilder
): Offset<TravelledPath>? {
    val stop = pathStops.getOrNull(indexStop) ?: return null
    return pathOffsetBuilder.toTravelledPath(stop.pathOffset)
}

fun makeSimpleReportTrain(
    fullInfra: FullInfra,
    envelope: Envelope,
    trainPath: PathProperties,
    rollingStock: RollingStock,
    schedule: List<SimulationScheduleItem>,
    pathItemPositions: List<Offset<Path>>,
): ReportTrain {
    // Compute energy consumed
    val envelopePath = EnvelopeTrainPath.from(fullInfra.rawInfra, trainPath)
    val mechanicalEnergyConsumed =
        EnvelopePhysics.getMechanicalEnergyConsumed(envelope, envelopePath, rollingStock)

    // Account for stop durations
    val stops =
        schedule
            .filter { it.stopFor != null }
            .map {
                TrainStop(it.pathOffset.distance.meters, it.stopFor!!.seconds, it.receptionSignal)
            }
    val envelopeStopWrapper = EnvelopeStopWrapper(envelope, stops)

    val pathItemTimes =
        pathItemPositions.map { position: Offset<Path> ->
            TimeDelta.fromSeconds(
                envelopeStopWrapper.interpolateArrivalAt(position.distance.meters)
            )
        }

    // Iterate over the points and simplify the results
    val points = envelopeStopWrapper.iteratePoints()
    val simplified =
        CurveSimplification.rdp(points, 1.0) { point, start, end ->
            val speedScaling = 1.0 / 0.2 // Arbitrary values adapted from tolerances previously used
            val timeScaling = 1.0 / 5
            if (abs(start.position - end.position) < 0.000001) {
                return@rdp abs(point.speed - start.speed) * speedScaling +
                    abs(point.time - start.time) * timeScaling
            }
            val projSpeed =
                start.speed +
                    (point.position - start.position) * (end.speed - start.speed) /
                        (end.position - start.position)
            val projTime =
                start.time +
                    (point.position - start.position) * (end.time - start.time) /
                        (end.position - start.position)
            return@rdp abs(point.speed - projSpeed) * speedScaling +
                abs(point.time - projTime) * timeScaling
        }
    assert(simplified.isNotEmpty()) { "simulation result shouldn't be empty" }

    return ReportTrain(
        simplified.map { Offset(it.position.meters) },
        simplified.map { it.time.seconds },
        simplified.map { it.speed },
        mechanicalEnergyConsumed,
        pathItemTimes,
    )
}
