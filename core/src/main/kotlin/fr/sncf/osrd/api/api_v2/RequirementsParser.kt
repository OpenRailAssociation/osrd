package fr.sncf.osrd.api.api_v2

import fr.sncf.osrd.api.api_v2.conflicts.TrainRequirementsRequest
import fr.sncf.osrd.api.api_v2.conflicts.WorkSchedulesRequest
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.standalone_sim.result.ResultTrain
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.TimeDelta
import fr.sncf.osrd.utils.units.seconds
import java.time.Duration.between
import java.time.ZonedDateTime
import org.slf4j.Logger
import org.slf4j.LoggerFactory

val requirementsParserLogger: Logger = LoggerFactory.getLogger("RequirementsParser")

fun parseTrainsRequirements(
    trainsRequirements: Map<Long, TrainRequirementsRequest>,
    startTime: ZonedDateTime
): List<Requirements> {
    val res = mutableListOf<Requirements>()
    for ((id, trainRequirements) in trainsRequirements) {
        val delta = TimeDelta(between(startTime, trainRequirements.startTime).toMillis())
        val spacingRequirements =
            parseSpacingRequirements(trainRequirements.spacingRequirements, delta)
        val routingRequirements =
            parseRoutingRequirements(trainRequirements.routingRequirements, delta)
        res.add(
            Requirements(
                RequirementId(id, RequirementType.TRAIN),
                spacingRequirements,
                routingRequirements
            )
        )
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
                        it.switches,
                        (it.endTime + timeToAdd).seconds
                    )
                }
            )
        )
    }
    return res
}

fun parseWorkSchedulesRequest(
    infra: RawSignalingInfra,
    workSchedulesRequest: WorkSchedulesRequest,
    startTime: ZonedDateTime
): Collection<Requirements> {
    val delta = TimeDelta(between(startTime, workSchedulesRequest.startTime).toMillis())
    return convertWorkScheduleMap(infra, workSchedulesRequest.workScheduleRequirements, delta)
}

/**
 * Convert work schedules into timetable spacing requirements, taking work schedule ids into
 * account.
 */
fun convertWorkScheduleMap(
    rawInfra: RawSignalingInfra,
    workSchedules: Map<Long, WorkSchedule>,
    timeToAdd: TimeDelta = 0.seconds
): Collection<Requirements> {
    val res = mutableListOf<Requirements>()
    for (entry in workSchedules) {
        val workScheduleRequirements = mutableListOf<ResultTrain.SpacingRequirement>()
        workScheduleRequirements.addAll(convertWorkSchedule(rawInfra, entry.value, timeToAdd))
        res.add(
            Requirements(
                RequirementId(entry.key, RequirementType.WORK_SCHEDULE),
                workScheduleRequirements,
                listOf()
            )
        )
    }
    return res
}

/**
 * Convert work schedules into timetable spacing requirements, without taking work schedule id into
 * account.
 */
fun convertWorkScheduleCollection(
    rawInfra: RawSignalingInfra,
    workSchedules: Collection<WorkSchedule>,
    timeToAdd: TimeDelta = 0.seconds,
): Requirements {
    val workSchedulesRequirements = mutableListOf<ResultTrain.SpacingRequirement>()
    for (workSchedule in workSchedules) {
        workSchedulesRequirements.addAll(convertWorkSchedule(rawInfra, workSchedule, timeToAdd))
    }
    return Requirements(
        RequirementId(DEFAULT_WORK_SCHEDULE_ID, RequirementType.WORK_SCHEDULE),
        workSchedulesRequirements,
        listOf()
    )
}

private fun convertWorkSchedule(
    rawInfra: RawSignalingInfra,
    workSchedule: WorkSchedule,
    timeToAdd: TimeDelta = 0.seconds,
): Collection<ResultTrain.SpacingRequirement> {
    val res = mutableListOf<ResultTrain.SpacingRequirement>()
    for (range in workSchedule.trackRanges) {
        val track = rawInfra.getTrackSectionFromName(range.trackSection) ?: continue
        for (chunk in rawInfra.getTrackSectionChunks(track)) {
            val chunkStartOffset = rawInfra.getTrackChunkOffset(chunk)
            val chunkEndOffset = chunkStartOffset + rawInfra.getTrackChunkLength(chunk).distance
            if (chunkStartOffset > range.end || chunkEndOffset < range.begin) continue
            val zone = rawInfra.getTrackChunkZone(chunk)
            if (zone == null) {
                requirementsParserLogger.info(
                    "Skipping part of work schedule [${workSchedule.startTime}; ${workSchedule.endTime}] " +
                        "because it is on a track not fully covered by routes: $track",
                )
                continue
            }
            res.add(
                ResultTrain.SpacingRequirement(
                    rawInfra.getZoneName(zone),
                    (workSchedule.startTime + timeToAdd).seconds,
                    (workSchedule.endTime + timeToAdd).seconds,
                    true
                )
            )
        }
    }
    return res
}
