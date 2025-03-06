package fr.sncf.osrd.api.api_v2.conflicts

import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.parseTrainsRequirements
import fr.sncf.osrd.api.api_v2.parseWorkSchedulesRequest
import fr.sncf.osrd.conflicts.Requirements
import fr.sncf.osrd.conflicts.detectRequirementConflicts
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import java.time.Duration
import java.time.ZonedDateTime
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class ConflictDetectionEndpointV2(private val infraManager: InfraManager) : Take {
    override fun act(req: Request?): Response {
        val recorder = DiagnosticRecorderImpl(false)
        return try {
            val body = RqPrint(req).printBody()
            val request =
                conflictRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            if (request.trainsRequirements.isEmpty()) {
                return RsJson(
                    RsWithBody(conflictResponseAdapter.toJson(ConflictDetectionResponse(listOf())))
                )
            }

            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)

            var minStartTime = request.trainsRequirements.values.minBy { it.startTime }.startTime
            val requirements = mutableListOf<Requirements>()
            if (request.workSchedules != null) {
                minStartTime = minOf(minStartTime, request.workSchedules.startTime)
                val convertedWorkSchedules =
                    parseWorkSchedulesRequest(infra.rawInfra, request.workSchedules, minStartTime)
                requirements.addAll(convertedWorkSchedules)
            }
            val trainRequirements =
                parseTrainsRequirements(request.trainsRequirements, minStartTime)
            requirements.addAll(trainRequirements)
            val conflicts = detectRequirementConflicts(requirements)
            val res = makeConflictDetectionResponse(conflicts, minStartTime)

            RsJson(RsWithBody(conflictResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}

private fun makeConflictDetectionResponse(
    conflicts: Collection<ConflictDetectionResult.Conflict>,
    startTime: ZonedDateTime
): ConflictDetectionResponse {
    return ConflictDetectionResponse(
        conflicts.map {
            Conflict(
                it.trainIds,
                it.workScheduleIds,
                startTime.plus(Duration.ofMillis((it.startTime * 1000).toLong())),
                startTime.plus(Duration.ofMillis((it.endTime * 1000).toLong())),
                it.conflictType,
                it.requirements.map {
                    ConflictRequirement(
                        it.zone,
                        startTime.plus(Duration.ofMillis((it.startTime * 1000).toLong())),
                        startTime.plus(Duration.ofMillis((it.endTime * 1000).toLong())),
                    )
                }
            )
        }
    )
}
