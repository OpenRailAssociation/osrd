package fr.sncf.osrd.api.standalone_sim

import fr.sncf.osrd.api.*
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.standalone_sim.runStandaloneSimulation
import fr.sncf.osrd.utils.*
import io.opentelemetry.api.trace.Span
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class SimulationEndpoint(
    private val infraManager: InfraProvider,
    private val electricalProfileSetManager: ElectricalProfileSetManager,
) : Take {
    override fun act(req: Request): Response {
        // Parse request input
        val body = RqPrint(req).printBody()
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

            // Parse path
            val trainPath =
                request.path.toTrainPath(infra.rawInfra, infra.blockInfra, electricalProfileMap)

            val res =
                runStandaloneSimulation(
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
                    parseRawSimulationScheduleItems(request.schedule),
                    request.initialSpeed,
                    request.margins,
                    request.pathItemPositions,
                )
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
