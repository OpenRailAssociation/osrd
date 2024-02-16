package fr.sncf.osrd.conflicts

import com.carrotsearch.hppc.IntArrayList
import com.squareup.moshi.Json
import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict
import fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict.ConflictType
import fr.sncf.osrd.standalone_sim.result.ResultTrain.RoutingRequirement
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import java.lang.Double.isFinite
import kotlin.math.min

interface SpacingTrainRequirement {
    val trainId: Long
    val spacingRequirements: List<SpacingRequirement>
}

interface RoutingTrainRequirement {
    val trainId: Long
    val routingRequirements: List<RoutingRequirement>
}

interface ResourceRequirement {
    val beginTime: Double
    val endTime: Double
}

class TrainRequirements(
    @Json(name = "train_id")
    override val trainId: Long, // Not the usual RJS ids, but an actual DB id
    @Json(name = "spacing_requirements") override val spacingRequirements: List<SpacingRequirement>,
    @Json(name = "routing_requirements") override val routingRequirements: List<RoutingRequirement>,
) : SpacingTrainRequirement, RoutingTrainRequirement

fun detectConflicts(trainRequirements: List<TrainRequirements>): List<Conflict> {
    val res = incrementalConflictDetector(trainRequirements).checkConflicts()
    return mergeConflicts(res)
}

interface IncrementalConflictDetector {
    fun checkConflicts(): List<Conflict>

    fun checkConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): List<Conflict>

    fun checkSpacingRequirement(req: SpacingRequirement): List<Conflict>

    fun checkRoutingRequirement(req: RoutingRequirement): List<Conflict>

    fun minDelayWithoutConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>,
        globalMinDelay: Double = 0.0
    ): Double

    fun maxDelayWithoutConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double

    fun timeOfNextConflict(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double
}

fun incrementalConflictDetector(
    trainRequirements: List<TrainRequirements>
): IncrementalConflictDetector {
    return IncrementalConflictDetectorImpl(trainRequirements)
}

class IncrementalConflictDetectorImpl(trainRequirements: List<TrainRequirements>) :
    IncrementalConflictDetector {
    private val spacingZoneRequirements =
        mutableMapOf<String, MutableList<SpacingZoneRequirement>>()
    private val routingZoneRequirements =
        mutableMapOf<String, MutableList<RoutingZoneRequirement>>()

    init {
        generateSpacingRequirements(trainRequirements)
        generateRoutingRequirements(trainRequirements)
    }

    data class SpacingZoneRequirement(
        val trainId: Long,
        override val beginTime: Double,
        override val endTime: Double,
    ) : ResourceRequirement

    private fun generateSpacingRequirements(trainRequirements: List<SpacingTrainRequirement>) {
        // organize requirements by zone
        for (req in trainRequirements) {
            for (spacingReq in req.spacingRequirements) {
                val zoneReq =
                    SpacingZoneRequirement(req.trainId, spacingReq.beginTime, spacingReq.endTime)
                spacingZoneRequirements.getOrPut(spacingReq.zone!!) { mutableListOf() }.add(zoneReq)
            }
        }
    }

    data class RoutingZoneConfig(
        val entryDet: String,
        val exitDet: String,
        val switches: Map<String, String>
    )

    data class RoutingZoneRequirement(
        val trainId: Long,
        val route: String,
        override val beginTime: Double,
        override val endTime: Double,
        val config: RoutingZoneConfig,
    ) : ResourceRequirement

    private fun generateRoutingRequirements(trainsRequirements: List<RoutingTrainRequirement>) {
        // reorganize requirements by zone
        for (trainRequirements in trainsRequirements) {
            val trainId = trainRequirements.trainId
            for (routeRequirements in trainRequirements.routingRequirements) {
                val route = routeRequirements.route!!
                var beginTime = routeRequirements.beginTime
                // TODO: make it a parameter
                if (routeRequirements.zones.any { it.switches.isNotEmpty() }) beginTime -= 5.0
                for (zoneRequirement in routeRequirements.zones) {
                    val endTime = zoneRequirement.endTime
                    val config =
                        RoutingZoneConfig(
                            zoneRequirement.entryDetector,
                            zoneRequirement.exitDetector,
                            zoneRequirement.switches!!
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
        for (requirements in spacingZoneRequirements.values) {
            for (conflictGroup in detectRequirementConflicts(requirements) { _, _ -> true }) {
                val trains = conflictGroup.map { it.trainId }
                val beginTime = conflictGroup.minBy { it.beginTime }.beginTime
                val endTime = conflictGroup.maxBy { it.endTime }.endTime
                res.add(Conflict(trains, beginTime, endTime, ConflictType.SPACING))
            }
        }
        return res
    }

    private fun detectRoutingConflicts(): List<Conflict> {
        // for each zone, check compatibility of overlapping requirements
        val res = mutableListOf<Conflict>()
        for (requirements in routingZoneRequirements.values) {
            for (conflictGroup in
                detectRequirementConflicts(requirements) { a, b -> a.config != b.config }) {
                val trains = conflictGroup.map { it.trainId }
                val beginTime = conflictGroup.minBy { it.beginTime }.beginTime
                val endTime = conflictGroup.maxBy { it.endTime }.endTime
                res.add(Conflict(trains, beginTime, endTime, ConflictType.ROUTING))
            }
        }
        return res
    }

    override fun checkConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): List<Conflict> {
        val res = mutableListOf<Conflict>()
        for (spacingRequirement in spacingRequirements) {
            res.addAll(checkSpacingRequirement(spacingRequirement))
        }
        for (routingRequirement in routingRequirements) {
            res.addAll(checkRoutingRequirement(routingRequirement))
        }
        return res
    }

    override fun checkSpacingRequirement(req: SpacingRequirement): List<Conflict> {
        val requirements = (spacingZoneRequirements[req.zone!!] ?: return listOf()).toMutableList()
        requirements.add(SpacingZoneRequirement(-1, req.beginTime, req.endTime))

        val res = mutableListOf<Conflict>()
        for (conflictGroup in detectRequirementConflicts(requirements) { _, _ -> true }) {
            if (conflictGroup.none { it.trainId == -1L })
                continue // don't report timetable conflicts to STDCM
            val filteredConflictGroup = conflictGroup.filter { it.trainId != -1L }
            val trains = filteredConflictGroup.map { it.trainId }
            val beginTime = filteredConflictGroup.minBy { it.beginTime }.beginTime
            val endTime = filteredConflictGroup.maxBy { it.endTime }.endTime
            res.add(Conflict(trains, beginTime, endTime, ConflictType.SPACING))
        }

        return res
    }

    override fun checkRoutingRequirement(req: RoutingRequirement): List<Conflict> {
        val res = mutableListOf<Conflict>()
        for (zoneReq in req.zones) {
            val requirements = (routingZoneRequirements[zoneReq.zone!!] ?: continue).toMutableList()
            requirements.add(
                RoutingZoneRequirement(
                    -1,
                    req.route,
                    req.beginTime,
                    zoneReq.endTime,
                    RoutingZoneConfig(
                        zoneReq.entryDetector,
                        zoneReq.exitDetector,
                        zoneReq.switches!!
                    )
                )
            )

            for (conflictGroup in
                detectRequirementConflicts(requirements) { a, b -> a.config != b.config }) {
                if (conflictGroup.none { it.trainId == -1L })
                    continue // don't report timetable conflicts to STDCM
                val filteredConflictGroup = conflictGroup.filter { it.trainId != -1L }
                val trains = filteredConflictGroup.map { it.trainId }
                val beginTime = filteredConflictGroup.minBy { it.beginTime }.beginTime
                val endTime = filteredConflictGroup.maxBy { it.endTime }.endTime
                res.add(Conflict(trains, beginTime, endTime, ConflictType.ROUTING))
            }
        }
        return res
    }

    override fun minDelayWithoutConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>,
        globalMinDelay: Double
    ): Double {
        var minDelay = Double.POSITIVE_INFINITY
        var hasConflict = false
        for (spacingRequirement in spacingRequirements) {
            if (spacingZoneRequirements[spacingRequirement.zone!!] != null) {
                val conflictingRequirements = spacingZoneRequirements[spacingRequirement.zone!!]!!.filter {
                    !(spacingRequirement.beginTime >= it.endTime || spacingRequirement.endTime <= it.beginTime)
                }
                if(conflictingRequirements.isNotEmpty()) {
                    hasConflict = true
                    val latestEndTime = conflictingRequirements.maxOf { it.endTime }
                    minDelay = min(minDelay, latestEndTime - spacingRequirement.beginTime)
                }
            }
        }
        for (routingRequirement in routingRequirements) {
            for (zoneReq in routingRequirement.zones) {
                if (routingZoneRequirements[zoneReq.zone!!] != null) {
                    val conflictingRequirements = routingZoneRequirements[zoneReq.zone!!]!!.filter {
                        !(routingRequirement.beginTime >= it.endTime || zoneReq.endTime <= it.beginTime)
                    }
                    if(conflictingRequirements.isNotEmpty()) {
                        hasConflict = true
                        val latestEndTime = conflictingRequirements.maxOf { it.endTime }
                        minDelay = min(minDelay, latestEndTime - routingRequirement.beginTime)
                    }
                }
            }
        }
        if (!hasConflict)
            return globalMinDelay
        else if (!isFinite(minDelay))
            return Double.POSITIVE_INFINITY
        else {
            val shiftedSpacingRequirements = spacingRequirements.toMutableList().onEach {
                it.beginTime += minDelay
                it.endTime += minDelay
            }
            val shiftedRoutingRequirements = routingRequirements.toMutableList().onEach { routingRequirement ->
                routingRequirement.beginTime += minDelay
                routingRequirement.zones.onEach { it.endTime += minDelay }
            }
            return minDelayWithoutConflicts(
                shiftedSpacingRequirements,
                shiftedRoutingRequirements,
                globalMinDelay + minDelay
            )
        }
    }

    override fun maxDelayWithoutConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double {
        var maxDelay = Double.POSITIVE_INFINITY
        for (spacingRequirement in spacingRequirements) {
            if (spacingZoneRequirements[spacingRequirement.zone!!] != null) {
                val endTime = spacingRequirement.endTime
                spacingZoneRequirements[spacingRequirement.zone!!]!!.forEach {
                    if (endTime <= it.beginTime) maxDelay = min(maxDelay, it.beginTime - endTime)
                }
            }
        }
        for (routingRequirement in routingRequirements) {
            for (zoneReq in routingRequirement.zones) {
                if (routingZoneRequirements[zoneReq.zone!!] != null) {
                    val endTime = zoneReq.endTime
                    routingZoneRequirements[zoneReq.zone!!]!!.forEach {
                        if (endTime <= it.beginTime)
                            maxDelay = min(maxDelay, it.beginTime - endTime)
                    }
                }
            }
        }
        return maxDelay
    }

    override fun timeOfNextConflict(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double {
        var timeOfNextConflict = Double.POSITIVE_INFINITY
        for (spacingRequirement in spacingRequirements) {
            if (spacingZoneRequirements[spacingRequirement.zone!!] != null) {
                spacingZoneRequirements[spacingRequirement.zone!!]!!.forEach {
                    if (it.beginTime < timeOfNextConflict) timeOfNextConflict = it.beginTime
                }
            }
        }
        for (routingRequirement in routingRequirements) {
            for (zoneReq in routingRequirement.zones) {
                if (routingZoneRequirements[zoneReq.zone!!] != null) {
                    routingZoneRequirements[zoneReq.zone!!]!!.forEach {
                        if (it.beginTime < timeOfNextConflict) timeOfNextConflict = it.beginTime
                    }
                }
            }
        }
        return timeOfNextConflict
    }
}

/**
 * Return a list of requirement conflict groups. If requirements pairs (A, B) and (B, C) are
 * conflicting, then (A, B, C) are part of the same conflict group.
 */
private fun <ReqT : ResourceRequirement> detectRequirementConflicts(
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
    END
}

class Event(val eventType: EventType, val time: Double) : Comparable<Event> {
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
    resources: HashMap<Set<Long>, MutableList<Conflict>>,
    conflictType: ConflictType
): MutableList<Conflict> {
    // sort and merge conflicts with overlapping time ranges
    val newConflicts = mutableListOf<Conflict>()
    for ((trainIds, conflicts) in resources) {
        // create an event list and sort it
        val events = mutableListOf<Event>()
        for (conflict in conflicts) {
            events.add(Event(EventType.BEGIN, conflict.startTime))
            events.add(Event(EventType.END, conflict.endTime))
        }

        events.sort()
        var eventCount = 0
        var eventBeginning = 0.0
        for (event in events) {
            when (event.eventType) {
                EventType.BEGIN -> {
                    if (++eventCount == 1) eventBeginning = event.time
                }
                EventType.END -> {
                    if (--eventCount == 0)
                        newConflicts.add(
                            Conflict(
                                trainIds.toMutableList(),
                                eventBeginning,
                                event.time,
                                conflictType
                            )
                        )
                }
            }
        }
    }
    return newConflicts
}

fun mergeConflicts(conflicts: List<Conflict>): List<Conflict> {
    // group conflicts by sets of conflicting trains
    val spacingResources = hashMapOf<Set<Long>, MutableList<Conflict>>()
    val routingResources = hashMapOf<Set<Long>, MutableList<Conflict>>()

    for (conflict in conflicts) {
        val conflictingGroup = conflict.trainIds.toSet()
        val conflictingMap =
            if (conflict.conflictType == ConflictType.SPACING) spacingResources
            else routingResources
        val conflictList = conflictingMap.getOrElse(conflictingGroup) { mutableListOf() }
        conflictList.add(conflict)
        conflictingMap[conflictingGroup] = conflictList
    }

    val mergedConflicts = mergeMap(spacingResources, ConflictType.SPACING)
    mergedConflicts += mergeMap(routingResources, ConflictType.ROUTING)

    return mergedConflicts
}
