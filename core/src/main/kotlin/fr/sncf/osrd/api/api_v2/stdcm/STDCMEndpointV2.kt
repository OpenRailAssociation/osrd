package fr.sncf.osrd.api.api_v2.stdcm

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.*
import fr.sncf.osrd.api.api_v2.pathfinding.findWaypointBlocks
import fr.sncf.osrd.api.api_v2.pathfinding.runPathfindingPostProcessing
import fr.sncf.osrd.api.api_v2.standalone_sim.MarginValue
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationSuccess
import fr.sncf.osrd.api.api_v2.standalone_sim.parseRawRollingStock
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.TimePerDistance
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.utils.chunksToRoutes
import fr.sncf.osrd.standalone_sim.runStandaloneSimulation
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.findPath
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import java.time.Duration.ofMillis
import java.util.HashSet
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

            // Run the STDCM pathfinding
            val path =
                findPath(
                    infra,
                    rollingStock,
                    request.comfort,
                    0.0,
                    parseSteps(infra, request.pathItems),
                    makeBlockAvailability(
                        infra,
                        spacingRequirements,
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

            // Run the simulation
            val simulationResponse =
                runStandaloneSimulation(
                    infra,
                    path.trainPath,
                    path.chunkPath,
                    infra.blockInfra.chunksToRoutes(infra.rawInfra, path.chunkPath.chunks),
                    null,
                    rollingStock,
                    request.comfort,
                    RJSAllowanceDistribution.MARECO,
                    request.speedLimitTag,
                    DistanceRangeMapImpl(),
                    false,
                    request.timeStep.seconds,
                    parseSimulationScheduleItems(path.stopResults),
                    0.0,
                    RangeValues(emptyList(), listOf(request.margin))
                )

            // Check for conflicts
            checkForConflicts(trainsRequirements, simulationResponse)

            val departureTime =
                request.startTime.plus(ofMillis((path.departureTime * 1000).toLong()))
            val response = STDCMSuccess(simulationResponse, pathfindingResponse, departureTime)
            RsJson(RsWithBody(stdcmResponseAdapter.toJson(response)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}

private fun parseSteps(infra: FullInfra, pathItems: List<STDCMPathItem>): List<STDCMStep> {
    assert(pathItems.last().stopDuration != null)
    return pathItems
        .map {
            STDCMStep(
                findWaypointBlocks(infra, it.locations),
                it.stopDuration?.seconds,
                it.stopDuration != null
            )
        }
        .toList()
}

private fun parseMarginValue(margin: MarginValue): AllowanceValue? {
    return when (margin) {
        is MarginValue.MinPer100Km -> {
            TimePerDistance(margin.value * 100)
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
    return trainStops.map {
        SimulationScheduleItem(Offset(it.position.meters), null, it.duration.seconds, true)
    }
}

/** Sanity check, we assert that the result is not conflicting with the scheduled timetable */
private fun checkForConflicts(
    trainRequirements: List<TrainRequirements>,
    simResult: SimulationSuccess
) {
    val conflictDetector = incrementalConflictDetector(trainRequirements)
    val spacingRequirements = parseSpacingRequirements(simResult.finalOutput.spacingRequirements)
    val routingRequirements = parseRoutingRequirements(simResult.finalOutput.routingRequirements)
    val conflicts = conflictDetector.checkConflicts(spacingRequirements, routingRequirements)
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
