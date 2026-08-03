package fr.sncf.osrd.api.standalone_sim

import fr.sncf.osrd.api.*
import fr.sncf.osrd.cli.Request
import fr.sncf.osrd.cli.Response
import fr.sncf.osrd.cli.RsJson
import fr.sncf.osrd.cli.RsText
import fr.sncf.osrd.cli.RsWithBody
import fr.sncf.osrd.cli.RsWithStatus
import fr.sncf.osrd.cli.Take
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.trainsim.Tracer
import fr.sncf.osrd.trainsim.runSimulation
import fr.sncf.osrd.utils.*
import io.opentelemetry.api.trace.Span
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import okio.Path.Companion.toPath

class SimulationEndpoint(
    private val infraManager: InfraProvider,
    private val electricalProfileSetManager: ElectricalProfileSetManager,
) : Take {
    override fun act(req: Request, ctx: Take.QueueContext?): Response {
        // Parse request input
        val body = req.body()
        val request =
            SimulationRequest.adapter.fromJson(body)
                ?: return RsWithStatus(RsText("missing request body"), 400)

        val logRequest = System.getenv("LOG_SIMULATION_REQUESTS")
        if (logRequest?.equals("true", ignoreCase = true) == true) {
            val time = LocalDateTime.now()
            val formatted = time.format(DateTimeFormatter.ofPattern("MM-dd-HH:mm:ss:SSS"))
            val filename = "simulation-$formatted.json"
            Span.current()?.setAttribute("request-file", filename)
            File(filename).printWriter().use {
                it.println(SimulationRequest.adapter.indent("    ").toJson(request))
            }
        }
        return run(request)
    }

    fun run(request: SimulationRequest): Response {
        try {
            // load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion)

            // load electrical profile set
            val electricalProfileMap =
                electricalProfileSetManager.getProfileMap(request.electricalProfileSetId)

            // Parse rolling stocks
            val rollingStock = parseRawRollingStock(request.physicsConsist)

            val backtrackLocations =
                request.schedule
                    .filter { it.stopDetails != null && it.stopDetails.isBacktracking }
                    .map { it.pathOffset }

            // Parse path
            val trainPath =
                request.path.toTrainPath(
                    backtrackLocations,
                    infra.rawInfra,
                    infra.blockInfra,
                    electricalProfileMap,
                )

            val res =
                okio.FileSystem.SYSTEM.write("/tmp/sim.log".toPath()) {
                    val tracer = Tracer(this)

                    runSimulation(
                        infra,
                        trainPath,
                        rollingStock,
                        request.comfort,
                        request.constraintDistribution.toRJS(),
                        request.speedLimitTag,
                        parsePowerRestrictions(request.powerRestrictions),
                        request.options.useElectricalProfiles,
                        request.options.useSpeedLimits ?: true,
                        2.0,
                        request.schedule,
                        request.initialSpeed,
                        request.margins,
                        tracer = tracer,
                    )
                }
            return RsJson(RsWithBody(simulationResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            if (ex is OSRDError && ex.osrdErrorType.isRecoverable) {
                val response = SimulationFailed(ex)
                return RsJson(RsWithBody(simulationResponseAdapter.toJson(response)))
            }
            return ExceptionHandler.handle(ex)
        }
    }
}
