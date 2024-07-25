package fr.sncf.osrd.api.api_v2

import fr.sncf.osrd.api.api_v2.conflicts.TrainRequirementsRequest
import fr.sncf.osrd.conflicts.TrainRequirements
import fr.sncf.osrd.standalone_sim.result.ResultTrain
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.TimeDelta
import java.time.Duration.between
import java.time.ZonedDateTime

fun parseRawTrainsRequirements(
    trainsRequirements: Map<Long, TrainRequirementsRequest>,
    startTime: ZonedDateTime
): List<TrainRequirements> {
    val res = mutableListOf<TrainRequirements>()
    for ((id, trainRequirements) in trainsRequirements) {
        val delta = TimeDelta(between(startTime, trainRequirements.startTime).toMillis())
        val spacingRequirements =
            parseSpacingRequirements(trainRequirements.spacingRequirements, delta)
        val routingRequirements =
            parseRoutingRequirements(trainRequirements.routingRequirements, delta)
        res.add(TrainRequirements(id, spacingRequirements, routingRequirements))
    }
    return res
}

fun parseSpacingRequirements(
    spacingRequirements: Collection<SpacingRequirement>,
    timeToAdd: TimeDelta = Duration.ZERO
): List<ResultTrain.SpacingRequirement> {
    val res = mutableListOf<ResultTrain.SpacingRequirement>()
    for (spacingRequirement in spacingRequirements) {
        res.add(
            ResultTrain.SpacingRequirement(
                spacingRequirement.zone,
                (spacingRequirement.beginTime + timeToAdd).seconds,
                (spacingRequirement.endTime + timeToAdd).seconds,
                true
            )
        )
    }
    return res
}

fun parseRoutingRequirements(
    routingRequirements: Collection<RoutingRequirement>,
    timeToAdd: TimeDelta = Duration.ZERO
): List<ResultTrain.RoutingRequirement> {
    val res = mutableListOf<ResultTrain.RoutingRequirement>()
    for (routingRequirement in routingRequirements) {
        res.add(
            ResultTrain.RoutingRequirement(
                routingRequirement.route,
                (routingRequirement.beginTime + timeToAdd).seconds,
                routingRequirement.zones.map {
                    ResultTrain.RoutingZoneRequirement(
                        it.zone,
                        it.entryDetector,
                        it.exitDetector,
                        it.trackNodes,
                        (it.endTime + timeToAdd).seconds
                    )
                }
            )
        )
    }
    return res
}
