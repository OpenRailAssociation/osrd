package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.SignalSighting
import fr.sncf.osrd.api.api_v2.ZoneUpdate
import fr.sncf.osrd.api.api_v2.standalone_sim.*
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopePhysics
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.standalone_sim.result.*
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
): CompleteReportTrain {
    assert(envelope.continuous)

    val legacyStops =
        schedule
            .filter { it.stopFor != null }
            .map { TrainStop(it.pathOffset.distance.meters, it.stopFor!!.seconds) }

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
        val stopTime = envelopeWithStops.interpolateTotalTime(stop.position) - stop.duration
        stops.add(ResultStops(stopTime, stop.position, stop.duration))
    }

    // Compute signal updates
    val startOffset = trainPathBlockOffset(rawInfra, blockInfra, blockPath, chunkPath)
    var blockPathLength = 0.meters
    for (block in blockPath) blockPathLength += blockInfra.getBlockLength(block).distance
    val endOffset = blockPathLength - startOffset - (envelope.endPos - envelope.beginPos).meters

    val pathSignals = pathSignalsInEnvelope(startOffset, blockPath, blockInfra, envelopeWithStops)
    val zoneOccupationChangeEvents =
        zoneOccupationChangeEvents(
            startOffset,
            blockPath,
            blockInfra,
            envelopeWithStops,
            rawInfra,
            trainLength
        )

    val zoneUpdates =
        zoneOccupationChangeEvents.map {
            ZoneUpdate(rawInfra.getZoneName(it.zone), it.time, Offset(it.offset), it.isEntry)
        }

    val signalSightings = mutableListOf<SignalSighting>()
    for ((i, pathSignal) in pathSignals.withIndex()) {
        val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
        var sightOffset =
            Distance.max(
                0.meters,
                pathSignal.pathOffset - rawInfra.getSignalSightDistance(physicalSignal)
            )
        if (i > 0) {
            val previousSignalOffset = pathSignals[i - 1].pathOffset
            sightOffset = Distance.max(sightOffset, previousSignalOffset)
        }
        signalSightings.add(
            SignalSighting(
                rawInfra.getPhysicalSignalName(
                    loadedSignalInfra.getPhysicalSignal(pathSignal.signal)
                )!!,
                envelopeWithStops.interpolateTotalTime(sightOffset.meters).seconds,
                Offset(sightOffset),
                "VL" // TODO: find out the real state
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
            incrementalPath
        )
    incrementalPath.extend(
        PathFragment(
            routePath,
            blockPath,
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
            startOffset,
            simulator,
            routePath,
            blockPath,
            detailedBlockPath,
            loadedSignalInfra,
            blockInfra,
            envelopeWithStops,
            rawInfra,
            rollingStock,
        )
    val reportTrain = makeSimpleReportTrain(fullInfra, envelope, trainPath, rollingStock, schedule)
    return CompleteReportTrain(
        reportTrain.positions,
        reportTrain.times,
        reportTrain.speeds,
        reportTrain.energyConsumption,
        signalSightings,
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

fun makeSimpleReportTrain(
    fullInfra: FullInfra,
    envelope: Envelope,
    trainPath: PathProperties,
    rollingStock: RollingStock,
    schedule: List<SimulationScheduleItem>,
): ReportTrain {
    // Compute energy consumed
    val envelopePath = EnvelopeTrainPath.from(fullInfra.rawInfra, trainPath)
    val mechanicalEnergyConsumed =
        EnvelopePhysics.getMechanicalEnergyConsumed(envelope, envelopePath, rollingStock)

    // Account for stop durations
    val stops =
        schedule
            .filter { it.stopFor != null }
            .map { TrainStop(it.pathOffset.distance.meters, it.stopFor!!.seconds) }
    val envelopeStopWrapper = EnvelopeStopWrapper(envelope, stops)

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
    return ReportTrain(
        simplified.map { Offset(it.position.meters) },
        simplified.map { it.time.seconds },
        simplified.map { it.speed },
        mechanicalEnergyConsumed,
    )
}
