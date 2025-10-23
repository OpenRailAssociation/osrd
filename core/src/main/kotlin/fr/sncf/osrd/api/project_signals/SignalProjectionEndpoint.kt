package fr.sncf.osrd.api.project_signals

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.signal_projection.projectSignals
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class SignalProjectionEndpoint(private val infraManager: InfraProvider) : Take {
    override fun act(req: Request?): Response {
        return try {
            val body = RqPrint(req).printBody()
            val request =
                signalProjectionRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            // Load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion)

            // Parse path
            val trainPath =
                request.path.toTrainPath(
                    infra.rawInfra,
                    infra.blockInfra,
                    electricalProfileMapping = null,
                )

            val signalProjections = mutableListOf<List<SignalUpdate>>()
            for (trainSimulation in request.trainSimulations) {
                val signalProjection =
                    projectSignals(
                        infra,
                        trainPath,
                        trainSimulation.signalCriticalPositions,
                        trainSimulation.zoneUpdates,
                        trainSimulation.simulationEndTime,
                    )
                signalProjections.add(signalProjection)
            }

            RsJson(
                RsWithBody(
                    signalProjectionResponseAdapter.toJson(
                        SignalProjectionResponse(signalProjections)
                    )
                )
            )
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}
