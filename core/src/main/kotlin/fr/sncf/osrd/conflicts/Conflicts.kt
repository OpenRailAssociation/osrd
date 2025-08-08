package fr.sncf.osrd.conflicts

import com.carrotsearch.hppc.IntArrayList
import com.squareup.moshi.Json
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.ZoneId

class Conflict(
    val startTime: Double,
    val endTime: Double,
    val conflictType: ConflictType,
    val requirements: Collection<ConflictRequirement>,
    val trainIds: Collection<String>,
    val workScheduleIds: Collection<String> = listOf(),
)

enum class ConflictType {
    @Json(name = "Spacing") SPACING,
    @Json(name = "Routing") ROUTING,
}

class ConflictRequirement(val zone: ZoneId, val startTime: Double, val endTime: Double)

interface ResourceRequirement {
    val beginTime: Double
    val endTime: Double
}

class Requirements(
    val id: RequirementId,
    val spacingRequirements: Collection<SpacingRequirement>,
    val routingRequirements: Collection<RoutingRequirement>,
)

data class RequirementId(
    // Either a train db id or a work schedule db id
    val id: String,
    val type: RequirementType,
)

enum class RequirementType {
    TRAIN,
    WORK_SCHEDULE,
}

fun detectConflicts(requirements: List<Requirements>): List<Conflict> {
    val res = conflictDetectorFromRequirements(requirements).checkConflicts()
    return mergeConflicts(res)
}

interface ConflictDetector {
    fun checkConflicts(): List<Conflict>
}

fun conflictDetectorFromRequirements(requirements: List<Requirements>): ConflictDetector {
    return ConflictDetectorImpl(requirements)
}

class ConflictDetectorImpl(requirements: List<Requirements>) : ConflictDetector {
    private val spacingZoneRequirements =
        mutableMapOf<ZoneId, MutableList<SpacingZoneRequirement>>()
    private val routingZoneRequirements =
        mutableMapOf<ZoneId, MutableList<RoutingZoneRequirement>>()

    init {
        generateSpacingRequirements(requirements)
        generateRoutingRequirements(requirements)
    }

    data class SpacingZoneRequirement(
        val id: RequirementId,
        override val beginTime: Double,
        override val endTime: Double,
    ) : ResourceRequirement

    private fun generateSpacingRequirements(requirements: List<Requirements>) {
        // organize requirements by zone
        for (req in requirements) {
            for (spacingReq in req.spacingRequirements) {
                val zoneReq =
                    SpacingZoneRequirement(req.id, spacingReq.beginTime, spacingReq.endTime)
                spacingZoneRequirements.getOrPut(spacingReq.zone) { mutableListOf() }.add(zoneReq)
            }
        }
    }

    data class RoutingZoneConfig(
        val entryDet: DirDetectorId,
        val exitDet: DirDetectorId,
        val switches: Map<String, String>,
    )

    data class RoutingZoneRequirement(
        val trainId: String,
        val route: RouteId,
        override val beginTime: Double,
        override val endTime: Double,
        val config: RoutingZoneConfig,
    ) : ResourceRequirement

    private fun generateRoutingRequirements(requirements: List<Requirements>) {
        // reorganize requirements by zone
        for (trainRequirements in requirements) {
            val trainId = trainRequirements.id.id
            for (routeRequirements in trainRequirements.routingRequirements) {
                val route = routeRequirements.route
                var beginTime = routeRequirements.beginTime
                // TODO: make it a parameter
                if (routeRequirements.zones.any { it.switches.isNotEmpty() }) beginTime -= 5.0
                for (zoneRequirement in routeRequirements.zones) {
                    val endTime = zoneRequirement.endTime
                    val config =
                        RoutingZoneConfig(
                            zoneRequirement.entryDetector,
                            zoneRequirement.exitDetector,
                            zoneRequirement.switches,
                        )
                    val requirement =
                        RoutingZoneRequirement(trainId, route, beginTime, endTime, config)
                    routingZoneRequirements
                        .getOrPut(zoneRequirement.zone) { mutableListOf() }
                        .add(requirement)
                }
            }
        }
    }

    override fun checkConflicts(): List<Conflict> {
        val res = mutableListOf<Conflict>()
        res.addAll(detectSpacingConflicts())
        res.addAll(detectRoutingConflicts())
        return res
    }

    private fun detectSpacingConflicts(): List<Conflict> {
        // look for requirement times overlaps.
        // as spacing requirements are exclusive, any overlap is a conflict
        val res = mutableListOf<Conflict>()
        for (entry in spacingZoneRequirements) {
            for (conflictGroup in detectConflicts(entry.value) { _, _ -> true }) {
                val beginTime = conflictGroup.minBy { it.beginTime }.beginTime
                val endTime = conflictGroup.maxBy { it.endTime }.endTime
                // If there are only conflicting work schedules, skip conflict group
                if (conflictGroup.all { it.id.type == RequirementType.WORK_SCHEDULE }) {
                    continue
                }
                val trains =
                    conflictGroup.filter { it.id.type == RequirementType.TRAIN }.map { it.id.id }
                val workSchedules =
                    conflictGroup
                        .filter { it.id.type == RequirementType.WORK_SCHEDULE }
                        .map { it.id.id }
                val conflictReq = ConflictRequirement(entry.key, beginTime, endTime)
                res.add(
                    Conflict(
                        beginTime,
                        endTime,
                        ConflictType.SPACING,
                        listOf(conflictReq),
                        trains,
                        workSchedules,
                    )
                )
            }
        }
        return res
    }

    private fun detectRoutingConflicts(): List<Conflict> {
        // for each zone, check compatibility of overlapping requirements
        val res = mutableListOf<Conflict>()
        for (entry in routingZoneRequirements) {
            for (conflictGroup in detectConflicts(entry.value) { a, b -> a.config != b.config }) {
                val trains = conflictGroup.map { it.trainId }
                val beginTime = conflictGroup.minBy { it.beginTime }.beginTime
                val endTime = conflictGroup.maxBy { it.endTime }.endTime
                val conflictReq = ConflictRequirement(entry.key, beginTime, endTime)
                res.add(
                    Conflict(beginTime, endTime, ConflictType.ROUTING, listOf(conflictReq), trains)
                )
            }
        }
        return res
    }
}

/**
 * Return a list of requirement conflict groups. If requirements pairs (A, B) and (B, C) are
 * conflicting, then (A, B, C) are part of the same conflict group.
 */
internal fun <ReqT : ResourceRequirement> detectConflicts(
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
            if (!conflicting(activeRequirement, requirement)) continue

            val conflictGroup = conflictGroupMap[activeRequirementIndex]
            // if there is no conflict group for this active requirement, create one
            if (conflictGroup == -1) {
                conflictGroupMap[activeRequirementIndex] = conflictGroups.size
                conflictGroupMap[requirementIndex] = conflictGroups.size
                conflictGroups.add(mutableListOf(activeRequirement, requirement))
                continue
            }

            // if this requirement was already added to the conflict group, skip it
            if (conflictingGroups.contains(conflictGroup)) continue
            conflictingGroups.add(conflictGroup)

            // otherwise, add the requirement to the existing conflict group
            conflictGroups[conflictGroup].add(requirement)
        }

        // add to active requirements
        activeRequirements.add(requirementIndex)
    }
    return conflictGroups
}

enum class EventType {
    BEGIN,
    END,
}

class Event(
    val eventType: EventType,
    val time: Double,
    val requirements: Collection<ConflictRequirement>,
) : Comparable<Event> {
    override fun compareTo(other: Event): Int {
        val timeDelta = this.time.compareTo(other.time)
        if (timeDelta != 0) return timeDelta
        return when (this.eventType) {
            other.eventType -> 0
            EventType.BEGIN -> -1
            EventType.END -> 1
        }
    }
}

fun mergeMap(
    resources: HashMap<ConflictingGroupKey, MutableList<Conflict>>,
    conflictType: ConflictType,
): MutableList<Conflict> {
    // sort and merge conflicts with overlapping time ranges
    val newConflicts = mutableListOf<Conflict>()
    for ((key, conflicts) in resources) {
        // create an event list and sort it
        val events = mutableListOf<Event>()
        for (conflict in conflicts) {
            events.add(Event(EventType.BEGIN, conflict.startTime, conflict.requirements))
            events.add(Event(EventType.END, conflict.endTime, conflict.requirements))
        }

        events.sort()
        var eventCount = 0
        var eventBeginning = 0.0
        var conflictReqs = mutableListOf<ConflictRequirement>()
        for (event in events) {
            when (event.eventType) {
                EventType.BEGIN -> {
                    if (++eventCount == 1) eventBeginning = event.time
                    conflictReqs.addAll(event.requirements)
                }
                EventType.END -> {
                    if (--eventCount > 0) continue
                    newConflicts.add(
                        Conflict(
                            eventBeginning,
                            event.time,
                            conflictType,
                            conflictReqs,
                            key.trainIds.toMutableList(),
                            key.workScheduleIds.toMutableList(),
                        )
                    )
                    conflictReqs = mutableListOf()
                }
            }
        }
    }
    return newConflicts
}

data class ConflictingGroupKey(val trainIds: Set<String>, val workScheduleIds: Set<String>)

fun mergeConflicts(conflicts: List<Conflict>): List<Conflict> {
    // group conflicts by sets of conflicting trains
    val spacingResources = hashMapOf<ConflictingGroupKey, MutableList<Conflict>>()
    val routingResources = hashMapOf<ConflictingGroupKey, MutableList<Conflict>>()

    for (conflict in conflicts) {
        val conflictingGroupKey =
            ConflictingGroupKey(conflict.trainIds.toSet(), conflict.workScheduleIds.toSet())
        val conflictingMap =
            when (conflict.conflictType) {
                ConflictType.SPACING -> spacingResources
                ConflictType.ROUTING -> routingResources
            }
        val conflictList = conflictingMap.getOrElse(conflictingGroupKey) { mutableListOf() }
        conflictList.add(conflict)
        conflictingMap[conflictingGroupKey] = conflictList
    }

    val mergedConflicts = mergeMap(spacingResources, ConflictType.SPACING)
    mergedConflicts += mergeMap(routingResources, ConflictType.ROUTING)

    return mergedConflicts
}
