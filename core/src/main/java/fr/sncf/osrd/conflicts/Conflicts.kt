package fr.sncf.osrd.conflicts

import com.carrotsearch.hppc.IntArrayList
import com.squareup.moshi.Json
import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict
import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict.ConflictType
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.standalone_sim.result.ResultTrain.RoutingRequirement


interface SpacingTrainRequirement {
    val trainId: Long
    val spacingRequirements: List<SpacingRequirement>
}

fun detectSpacingConflicts(trainRequirements: List<SpacingTrainRequirement>): List<Conflict> {
    val res = mutableListOf<Conflict>()

    data class ZoneRequirement(
        val trainId: Long,
        override val beginTime: Double,
        override val endTime: Double,
        val switches: Map<String, String>,
    ): ResourceRequirement

    // organize requirements by zone
    val zoneRequirements = mutableMapOf<String, MutableList<ZoneRequirement>>()
    for (req in trainRequirements) {
        for (spacingReq in req.spacingRequirements) {
            val zoneReq = ZoneRequirement(
                req.trainId, spacingReq.beginTime, spacingReq.endTime, spacingReq.switches
            )
            zoneRequirements.getOrPut(spacingReq.zone!!) { mutableListOf() }.add(zoneReq)
        }
    }

    // look for requirement times overlaps.
    // as spacing requirements are exclusive, any overlap is a conflict
    for ((_, requirements) in zoneRequirements.entries) {
        for (conflictGroup in detectRequirementConflicts(requirements) { a, b -> a.switches == b.switches }) {
            val trains = conflictGroup.map { it.trainId }
            val beginTime = conflictGroup.minBy { it.beginTime }.beginTime
            val endTime = conflictGroup.maxBy { it.endTime }.endTime

            res.add(Conflict(trains, beginTime, endTime, ConflictType.SPACING))
        }
    }
    return res
}


interface RoutingTrainRequirement {
    val trainId: Long
    val routingRequirements: List<RoutingRequirement>
}


fun detectRoutingConflicts(trainsRequirements: List<RoutingTrainRequirement>): List<Conflict> {
    val res = mutableListOf<Conflict>()

    data class RoutingZoneConfig(val entryDet: String, val exitDet: String, val switches: Map<String, String>)
    data class ZoneRequirement(
        val trainId: Long,
        val route: String,
        override val beginTime: Double,
        override val endTime: Double,
        val config: RoutingZoneConfig,
    ): ResourceRequirement

    // reorganize requirements by zone
    val zoneRequirements = mutableMapOf<String, MutableList<ZoneRequirement>>()
    for (trainRequirements in trainsRequirements) {
        val trainId = trainRequirements.trainId;
        for (routeRequirements in trainRequirements.routingRequirements) {
            val route = routeRequirements.route!!
            var beginTime = routeRequirements.beginTime
            // TODO: make it a parameter
            if (routeRequirements.zones.any { it.switches.isNotEmpty() })
                beginTime -= 5.0
            for (zoneRequirement in routeRequirements.zones) {
                val endTime = zoneRequirement.endTime
                val config = RoutingZoneConfig(zoneRequirement.entryDetector, zoneRequirement.exitDetector, zoneRequirement.switches!!)
                val requirement = ZoneRequirement(trainId, route, beginTime, endTime, config)
                zoneRequirements.getOrPut(zoneRequirement.zone) { mutableListOf() }.add(requirement)
            }
        }
    }

    // for each zone, check compatibility of overlapping requirements
    for ((_, requirements) in zoneRequirements.entries) {
        for (conflictGroup in detectRequirementConflicts(requirements) { a, b -> a.config != b.config }) {
            val trains = conflictGroup.map { it.trainId }
            val beginTime = conflictGroup.minBy { it.beginTime }.beginTime
            val endTime = conflictGroup.maxBy { it.endTime }.endTime
            res.add(Conflict(trains, beginTime, endTime, ConflictType.ROUTING))
        }
    }
    return res
}

interface ResourceRequirement {
    val beginTime: Double
    val endTime: Double
}

/**
 * Return a list of requirement conflict groups.
 * If requirements pairs (A, B) and (B, C) are conflicting, then (A, B, C) are part of the same conflict group.
 */
fun <ReqT: ResourceRequirement> detectRequirementConflicts(
    requirements: MutableList<ReqT>,
    conflicting: (ReqT, ReqT) -> Boolean,
): List<List<ReqT>> {
    val conflictGroups = mutableListOf<MutableList<ReqT>>()

    // a lookup table from requirement to conflict group index, if any
    val conflictGroupMap = Array(requirements.size) { -1 }

    val activeRequirements = IntArrayList()

    requirements.sortBy { it.beginTime }
    for (requirementIndex in 0 until requirements.size) {
        val requirement = requirements[requirementIndex]
        // remove inactive requirements
        activeRequirements.removeAll { requirements[it].endTime <= requirement.beginTime }

        // check compatibility with active requirements
        val conflictingGroups = IntArrayList()
        for (activeRequirementCursor in activeRequirements) {
            val activeRequirementIndex = activeRequirementCursor.value
            val activeRequirement = requirements[activeRequirementIndex]
            if (!conflicting(activeRequirement, requirement))
                continue

            val conflictGroup = conflictGroupMap[activeRequirementIndex]
            // if there is no conflict group for this active requirement, create one
            if (conflictGroup == -1) {
                conflictGroupMap[activeRequirementIndex] = conflictGroups.size
                conflictGroupMap[requirementIndex] = conflictGroups.size
                conflictGroups.add(mutableListOf(activeRequirement, requirement))
                continue
            }

            // if this requirement was already added to the conflict group, skip it
            if (conflictingGroups.contains(conflictGroup))
                continue
            conflictingGroups.add(conflictGroup)

            // otherwise, add the requirement to the existing conflict group
            conflictGroups[conflictGroup].add(requirement)
        }

        // add to active requirements
        activeRequirements.add(requirementIndex)
    }
    return conflictGroups
}


class TrainRequirements(
    @Json(name = "train_id")
    override val trainId: Long, // Not the usual RJS ids, but an actual DB id
    @Json(name = "spacing_requirements")
    override val spacingRequirements: List<SpacingRequirement>,
    @Json(name = "routing_requirements")
    override val routingRequirements: List<RoutingRequirement>,
): SpacingTrainRequirement, RoutingTrainRequirement


fun detectConflicts(trainRequirements: List<TrainRequirements>) : List<Conflict> {
    val res = mutableListOf<Conflict>()
    res.addAll(detectSpacingConflicts(trainRequirements))
    res.addAll(detectRoutingConflicts(trainRequirements))
    return res
}
