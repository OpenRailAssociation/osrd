package fr.sncf.osrd.api.conflicts

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.api.parseTrainsRequirements
import fr.sncf.osrd.api.parseWorkSchedulesRequest
import fr.sncf.osrd.conflicts.Conflict
import fr.sncf.osrd.conflicts.Requirements
import fr.sncf.osrd.conflicts.detectConflicts
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
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

class ConflictDetectionEndpoint(private val infraManager: InfraProvider) : Take {
    override fun act(req: Request?): Response {
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

            val infra = infraManager.getInfra(request.infra, request.expectedVersion)

            var minStartTime = request.trainsRequirements.values.minBy { it.startTime }.startTime
            val requirements = mutableListOf<Requirements>()
            if (request.workSchedules != null) {
                minStartTime = minOf(minStartTime, request.workSchedules.startTime)
                val convertedWorkSchedules =
                    parseWorkSchedulesRequest(infra.rawInfra, request.workSchedules, minStartTime)
                requirements.addAll(convertedWorkSchedules)
            }
            val trainRequirements =
                parseTrainsRequirements(infra.rawInfra, request.trainsRequirements, minStartTime)
            requirements.addAll(trainRequirements)
            val conflicts = detectConflicts(requirements)
            val res = makeConflictDetectionResponse(infra.rawInfra, conflicts, minStartTime)

            RsJson(RsWithBody(conflictResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}

private fun makeConflictDetectionResponse(
    infra: RawSignalingInfra,
    conflicts: Collection<Conflict>,
    startTime: ZonedDateTime,
): ConflictDetectionResponse {
    return ConflictDetectionResponse(
        conflicts.map {
            ConflictResponse(
                it.trainIds,
                it.workScheduleIds,
                startTime.plus(Duration.ofMillis((it.startTime * 1000).toLong())),
                startTime.plus(Duration.ofMillis((it.endTime * 1000).toLong())),
                it.conflictType,
                it.requirements.map { requirement ->
                    ConflictRequirement(
                        infra.getZoneName(requirement.zone),
                        startTime.plus(Duration.ofMillis((requirement.startTime * 1000).toLong())),
                        startTime.plus(Duration.ofMillis((requirement.endTime * 1000).toLong())),
                    )
                },
            )
        }
    )
}
