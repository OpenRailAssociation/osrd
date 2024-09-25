package fr.sncf.osrd.api.stdcm

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.pathfinding.convertPathfindingResult
import fr.sncf.osrd.api.pathfinding.findWaypointBlocks
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint
import fr.sncf.osrd.standalone_sim.result.ResultTrain
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult
import fr.sncf.osrd.standalone_sim.run
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.findPath
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.StandaloneTrainSchedule
import fr.sncf.osrd.train.TrainStop
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class STDCMEndpoint(private val infraManager: InfraManager) : Take {
    @Throws(OSRDError::class)
    override fun act(req: Request): Response {
        val recorder = DiagnosticRecorderImpl(false)
        return try {
            // Parse request input
            val body = RqPrint(req).printBody()
            val request =
                STDCMRequest.adapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            // parse input data
            val startTime = request.startTime
            if (java.lang.Double.isNaN(startTime))
                throw OSRDError(ErrorType.InvalidSTDCMUnspecifiedStartTime)
            // TODO : change with get infra when the front is ready
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)
            val rollingStock = RJSRollingStockParser.parse(request.rollingStock)
            val comfort = request.comfort
            val steps = parseSteps(infra, request.steps)
            val tag = request.speedLimitComposition
            var standardAllowance: AllowanceValue? = null
            if (request.standardAllowance != null)
                standardAllowance =
                    RJSStandaloneTrainScheduleParser.parseAllowanceValue(request.standardAllowance)
            assert(java.lang.Double.isFinite(startTime))

            // Run the STDCM pathfinding
            val res =
                findPath(
                    infra,
                    rollingStock,
                    comfort,
                    startTime,
                    steps,
                    makeBlockAvailability(
                        request.spacingRequirements,
                        gridMarginBeforeTrain = request.gridMarginBeforeSTDCM,
                        gridMarginAfterTrain = request.gridMarginAfterSTDCM
                    ),
                    request.timeStep,
                    request.maximumDepartureDelay,
                    request.maximumRunTime,
                    tag,
                    standardAllowance,
                    Pathfinding.TIMEOUT
                )
            if (res == null) {
                val error = OSRDError(ErrorType.PathfindingGenericError)
                return ExceptionHandler.toResponse(error)
            }

            // Build the response
            val simResult = StandaloneSimResult()
            simResult.speedLimits.add(
                ResultEnvelopePoint.from(computeMRSP(res.trainPath, rollingStock, false, tag))
            )
            simResult.baseSimulations.add(
                run(
                    res.envelope,
                    res.trainPath,
                    res.chunkPath,
                    makeTrainSchedule(res.envelope.endPos, rollingStock, comfort, res.stopResults),
                    infra
                )
            )
            simResult.ecoSimulations.add(null)
            checkForConflicts(
                request.spacingRequirements,
                simResult.baseSimulations.first(),
                res.departureTime
            )
            val pathfindingRes =
                convertPathfindingResult(infra.blockInfra, infra.rawInfra, res.blocks, recorder)
            val response = STDCMResponse(simResult, pathfindingRes, res.departureTime)
            RsJson(RsWithBody(STDCMResponse.adapter.toJson(response)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}

private fun parseSteps(infra: FullInfra, steps: List<STDCMRequest.STDCMStep>): List<STDCMStep> {
    assert(steps.last().stop)
    steps.first().stop = false
    steps.first().stopDuration = null
    return steps
        .stream()
        .map { step: STDCMRequest.STDCMStep ->
            STDCMStep(findWaypointBlocks(infra, step.waypoints), step.stopDuration, step.stop)
        }
        .toList()
}

/** Generate a train schedule matching the envelope and rolling stock, with one stop at the end */
fun makeTrainSchedule(
    endPos: Double,
    rollingStock: RollingStock?,
    comfort: Comfort?,
    trainStops: List<TrainStop>
): StandaloneTrainSchedule {
    val mutTrainStops = ArrayList(trainStops)
    // Force the train to end its path at speed=0 and on closed signal
    mutTrainStops.add(TrainStop(endPos, 0.1, true))
    return StandaloneTrainSchedule(
        rollingStock,
        0.0,
        ArrayList(),
        mutTrainStops,
        listOf(),
        null,
        comfort,
        null,
        null
    )
}

/** Sanity check, we assert that the result is not conflicting with the scheduled timetable */
private fun checkForConflicts(
    spacingRequirements: Collection<ResultTrain.SpacingRequirement>,
    simResult: ResultTrain,
    departureTime: Double
) {
    val requirements = TrainRequirements(0, spacingRequirements, listOf())
    val conflictDetector = incrementalConflictDetector(listOf(requirements))
    val conflicts =
        conflictDetector.checkConflicts(
            simResult.spacingRequirements.map {
                ResultTrain.SpacingRequirement(
                    it.zone,
                    it.beginTime + departureTime,
                    it.endTime + departureTime,
                    it.isComplete
                )
            },
            simResult.routingRequirements.map {
                ResultTrain.RoutingRequirement(it.route, it.beginTime + departureTime, it.zones)
            }
        )
    assert(conflicts.isEmpty()) { "STDCM result is conflicting with the scheduled timetable" }
}
