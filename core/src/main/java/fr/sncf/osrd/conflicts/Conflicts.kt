package fr.sncf.osrd.conflicts

import com.squareup.moshi.Json
import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict
import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict.ConflictType
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement


class TrainRequirements(
    @Json(name = "train_id")
    val trainId: Long, // Not the usual RJS ids, but an actual DB id
    @Json(name = "spacing_requirements")
    val spacingRequirements: List<SpacingRequirement>
)


fun detectConflicts(trainRequirements: List<TrainRequirements>) : List<Conflict> {
    val res = mutableListOf<Conflict>()

    data class ZoneRequirement(
        val trainId: Long,
        val start: Double,
        val end: Double,
    )

    val zoneRequirements = mutableMapOf<String, MutableList<ZoneRequirement>>()

    for (req in trainRequirements) {
        for (spacingReq in req.spacingRequirements) {
            val zoneReq = ZoneRequirement(
                req.trainId, spacingReq.beginTime, spacingReq.endTime
            )
            zoneRequirements.getOrPut(spacingReq.zone) { mutableListOf() }.add(zoneReq)
        }
    }

    for ((_, requirements) in zoneRequirements.entries) {
        requirements.sortBy { it.start }
        for (i in 1 until requirements.size) {
            val lastRequirement = requirements[i - 1]
            val requirement = requirements[i]
            if (requirement.start < lastRequirement.end) {
                res.add(Conflict(listOf(lastRequirement.trainId, requirement.trainId), requirement.start, lastRequirement.end, ConflictType.SPACING))
            }
        }
    }

    return res
}
