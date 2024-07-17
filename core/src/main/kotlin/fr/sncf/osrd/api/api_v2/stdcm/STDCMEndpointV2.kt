package fr.sncf.osrd.api.api_v2.stdcm

import com.google.common.collect.ImmutableRangeMap
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.*
import fr.sncf.osrd.api.api_v2.pathfinding.findWaypointBlocks
import fr.sncf.osrd.api.api_v2.pathfinding.runPathfindingPostProcessing
import fr.sncf.osrd.api.api_v2.standalone_sim.*
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.TimePerDistance
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.MRSP
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.utils.chunksToRoutes
import fr.sncf.osrd.standalone_sim.makeElectricalProfiles
import fr.sncf.osrd.standalone_sim.makeMRSPResponse
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.standalone_sim.runScheduleMetadataExtractor
import fr.sncf.osrd.stdcm.PlannedTimingData
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.findPath
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import java.time.Duration.between
import java.time.Duration.ofMillis
import java.time.ZonedDateTime
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class STDCMEndpointV2(private val infraManager: InfraManager) : Take {
    @Throws(OSRDError::class)
    override fun act(req: Request): Response {
        val recorder = DiagnosticRecorderImpl(false)
        return try {
            // Parse request input
            val body = RqPrint(req).printBody()
            val request =
                stdcmRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            // parse input data
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)
            val rollingStock =
                parseRawRollingStock(
                    request.rollingStock,
                    request.rollingStockLoadingGauge,
                    request.rollingStockSupportedSignalingSystems
                )
            val trainsRequirements =
                parseRawTrainsRequirements(request.trainsRequirements, request.startTime)
            val spacingRequirements = trainsRequirements.flatMap { it.spacingRequirements }
            val steps = parseSteps(infra, request.pathItems, request.startTime)

            // Run the STDCM pathfinding
            val path =
                findPath(
                    infra,
                    rollingStock,
                    request.comfort,
                    0.0,
                    steps,
                    makeBlockAvailability(
                        infra,
                        spacingRequirements,
                        workSchedules = request.workSchedules,
                        steps,
                        gridMarginBeforeTrain = request.timeGapBefore.seconds,
                        gridMarginAfterTrain = request.timeGapAfter.seconds
                    ),
                    request.timeStep!!.seconds,
                    request.maximumDepartureDelay!!.seconds,
                    request.maximumRunTime.seconds,
                    request.speedLimitTag,
                    parseMarginValue(request.margin),
                    Pathfinding.TIMEOUT
                )
            if (path == null) {
                val response = PathNotFound()
                return RsJson(RsWithBody(stdcmResponseAdapter.toJson(response)))
            }
            val pathfindingResponse = runPathfindingPostProcessing(infra, path.blocks)

            val simulationResponse =
                buildSimResponse(infra, path, rollingStock, request.speedLimitTag, request.comfort)

            // Check for conflicts
            checkForConflicts(trainsRequirements, simulationResponse, path.departureTime)

            val departureTime =
                request.startTime.plus(ofMillis((path.departureTime * 1000).toLong()))
            val response = STDCMSuccess(simulationResponse, pathfindingResponse, departureTime)
            RsJson(RsWithBody(stdcmResponseAdapter.toJson(response)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }

    /** Build the simulation part of the response */
    private fun buildSimResponse(
        infra: FullInfra,
        path: STDCMResult,
        rollingStock: RollingStock,
        speedLimitTag: String?,
        comfort: RollingStock.Comfort
    ): SimulationSuccess {
        val reportTrain =
            runScheduleMetadataExtractor(
                path.envelope,
                path.trainPath,
                path.chunkPath,
                infra,
                infra.blockInfra.chunksToRoutes(infra.rawInfra, path.chunkPath.chunks),
                rollingStock,
                parseSimulationScheduleItems(path.stopResults),
            )

        // Lighter description of the same simulation result
        val simpleReportTrain =
            ReportTrain(
                reportTrain.positions,
                reportTrain.times,
                reportTrain.speeds,
                reportTrain.energyConsumption,
                reportTrain.scheduledPointsHonored
            )
        val speedLimits = MRSP.computeMRSP(path.trainPath, rollingStock, false, speedLimitTag)

        // All simulations are the same for now
        return SimulationSuccess(
            base = simpleReportTrain,
            provisional = simpleReportTrain,
            finalOutput = reportTrain,
            mrsp = makeMRSPResponse(speedLimits),
            electricalProfiles = buildSTDCMElectricalProfiles(infra, path, rollingStock, comfort),
        )
    }

    /** Build the electrical profiles from the path */
    private fun buildSTDCMElectricalProfiles(
        infra: FullInfra,
        path: STDCMResult,
        rollingStock: RollingStock,
        comfort: RollingStock.Comfort
    ): RangeValues<ElectricalProfileValue> {
        val envelopeSimPath = EnvelopeTrainPath.from(infra.rawInfra, path.trainPath, null)
        val electrificationMap =
            envelopeSimPath.getElectrificationMap(
                rollingStock.basePowerClass,
                ImmutableRangeMap.of(),
                rollingStock.powerRestrictions,
                false
            )
        val curvesAndConditions = rollingStock.mapTractiveEffortCurves(electrificationMap, comfort)
        val electrificationRanges =
            ElectrificationRange.from(curvesAndConditions.conditions, electrificationMap)
        return makeElectricalProfiles(electrificationRanges)
    }
}

private fun parseSteps(
    infra: FullInfra,
    pathItems: List<STDCMPathItem>,
    startTime: ZonedDateTime
): List<STDCMStep> {
    if (pathItems.last().stopDuration == null) {
        throw OSRDError(ErrorType.MissingLastSTDCMStop)
    }
    return pathItems
        .map {
            STDCMStep(
                findWaypointBlocks(infra, it.locations),
                it.stopDuration?.seconds,
                it.stopDuration != null,
                if (it.stepTimingData != null)
                    PlannedTimingData(
                        TimeDelta(between(startTime, it.stepTimingData.arrivalTime).toMillis()),
                        it.stepTimingData.arrivalTimeToleranceBefore,
                        it.stepTimingData.arrivalTimeToleranceAfter
                    )
                else null
            )
        }
        .toList()
}

private fun parseMarginValue(margin: MarginValue): AllowanceValue? {
    return when (margin) {
        is MarginValue.MinPer100Km -> {
            TimePerDistance(margin.value)
        }
        is MarginValue.Percentage -> {
            Percentage(margin.percentage)
        }
        is MarginValue.None -> {
            null
        }
    }
}

private fun parseSimulationScheduleItems(
    trainStops: List<TrainStop>
): List<SimulationScheduleItem> {
    return parseRawSimulationScheduleItems(
        trainStops.map {
            val duration = if (it.duration > 0.0) it.duration.seconds else null
            SimulationScheduleItem(Offset(it.position.meters), null, duration, it.onStopSignal)
        }
    )
}

/** Sanity check, we assert that the result is not conflicting with the scheduled timetable */
private fun checkForConflicts(
    timetableTrainRequirements: List<TrainRequirements>,
    simResult: SimulationSuccess,
    departureTime: Double
) {
    // Shifts the requirements generated by the new train to account for its departure time
    val newTrainSpacingRequirement =
        simResult.finalOutput.spacingRequirements.map {
            SpacingRequirement(
                it.zone,
                it.beginTime + departureTime.seconds,
                it.endTime + departureTime.seconds
            )
        }
    val conflictDetector = incrementalConflictDetector(timetableTrainRequirements)
    val spacingRequirements = parseSpacingRequirements(newTrainSpacingRequirement)
    val conflicts = conflictDetector.checkConflicts(spacingRequirements, listOf())
    assert(conflicts.isEmpty()) { "STDCM result is conflicting with the scheduled timetable" }
}

private fun findWaypointBlocks(
    infra: FullInfra,
    waypoints: Collection<TrackLocation>
): Set<PathfindingEdgeLocationId<Block>> {
    val waypointBlocks = HashSet<PathfindingEdgeLocationId<Block>>()
    for (waypoint in waypoints) {
        for (direction in Direction.entries) {
            waypointBlocks.addAll(findWaypointBlocks(infra, waypoint, direction))
        }
    }
    return waypointBlocks
}
