package fr.sncf.osrd.api.api_v2.project_signals

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.pathfinding.makeChunkPath
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.signal_projection.projectSignals
import fr.sncf.osrd.sim_infra.api.convertRoutePath
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class SignalProjectionEndpointV2(private val infraManager: InfraManager) : Take {
    override fun act(req: Request?): Response {
        val recorder = DiagnosticRecorderImpl(false)
        return try {
            val body = RqPrint(req).printBody()
            val request =
                signalProjectionRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            // Load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)

            // Parse path
            val chunkPath = makeChunkPath(infra.rawInfra, request.trackSectionRanges)
            val routePath = infra.rawInfra.convertRoutePath(request.routes)

            val signalProjections = mutableMapOf<Long, List<SignalUpdate>>()
            for ((id, trainSimulation) in request.trainSimulations) {
                val signalProjection =
                    projectSignals(
                        infra,
                        chunkPath,
                        routePath,
                        trainSimulation.signalSightings,
                        trainSimulation.zoneUpdates,
                        trainSimulation.simulationEndTime
                    )
                signalProjections[id] = signalProjection
            }

            RsJson(
                RsWithBody(
                    signalProjectionResponseAdapter.toJson(
                        SignalProjectionResponse(signalProjections.toMap())
                    )
                )
            )
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}
