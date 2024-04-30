package fr.sncf.osrd.api.api_v2.conflicts

import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.conflicts.TrainRequirements
import fr.sncf.osrd.conflicts.detectConflicts
import fr.sncf.osrd.standalone_sim.result.ResultTrain
import fr.sncf.osrd.utils.units.TimeDelta
import java.time.Duration
import java.time.Duration.between
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

            val minStartTime = request.trainsRequirements.values.minBy { it.startTime }.startTime
            val trainRequirements = makeTrainRequirements(request.trainsRequirements, minStartTime)
            val conflicts = detectConflicts(trainRequirements)
            val res = makeConflictDetectionResponse(conflicts, minStartTime)

            RsJson(RsWithBody(conflictResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}

private fun makeTrainRequirements(
    trainsReqs: Map<Long, TrainRequirementsRequest>,
    startTime: ZonedDateTime
): List<TrainRequirements> {
    val trainRequirements = mutableListOf<TrainRequirements>()
    for ((id, trainReqs) in trainsReqs) {
        val delta = TimeDelta(between(startTime, trainReqs.startTime).toMillis())
        val routingRequirements = mutableListOf<ResultTrain.RoutingRequirement>()
        for (routingReq in trainReqs.routingRequirements) {
            routingRequirements.add(
                ResultTrain.RoutingRequirement(
                    routingReq.route,
                    (routingReq.beginTime + delta).seconds,
                    routingReq.zones.map {
                        ResultTrain.RoutingZoneRequirement(
                            it.zone,
                            it.entryDetector,
                            it.exitDetector,
                            it.switches,
                            (it.endTime + delta).seconds
                        )
                    }
                )
            )
        }
        val spacingRequirements = mutableListOf<ResultTrain.SpacingRequirement>()
        for (spacingReq in trainReqs.spacingRequirements) {
            spacingRequirements.add(
                ResultTrain.SpacingRequirement(
                    spacingReq.zone,
                    (spacingReq.beginTime + delta).seconds,
                    (spacingReq.endTime + delta).seconds,
                    true
                )
            )
        }
        trainRequirements.add(TrainRequirements(id, spacingRequirements, routingRequirements))
    }
    return trainRequirements
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
                it.conflictType
            )
        }
    )
}
