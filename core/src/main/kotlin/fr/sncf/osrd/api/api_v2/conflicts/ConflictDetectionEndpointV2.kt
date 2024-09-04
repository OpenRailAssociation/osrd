package fr.sncf.osrd.api.api_v2.conflicts

import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.api_v2.parseRawTrainsRequirements
import fr.sncf.osrd.conflicts.detectConflicts
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

class ConflictDetectionEndpointV2 : Take {
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

            val minStartTime = request.trainsRequirements.values.minBy { it.startTime }.startTime
            val trainRequirements =
                parseRawTrainsRequirements(request.trainsRequirements, minStartTime)
            val conflicts = detectConflicts(trainRequirements)
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
