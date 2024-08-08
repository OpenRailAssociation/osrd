package fr.sncf.osrd.conflicts

import com.carrotsearch.hppc.IntArrayList
import com.squareup.moshi.Json
import fr.sncf.osrd.standalone_sim.result.ResultTrain.RoutingRequirement
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import kotlin.math.max
import kotlin.math.min

interface IncrementalConflictDetector {
    fun checkConflicts(): List<Conflict>

    fun checkConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): List<Conflict>

    /** Only check the given new spacing requirement against the scheduled requirements */
    fun checkSpacingRequirement(req: SpacingRequirement): List<Conflict>

    /** Only check the given new routing requirement against the scheduled requirements */
    fun checkRoutingRequirement(req: RoutingRequirement): List<Conflict>

    fun minDelayWithoutConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double

    fun maxDelayWithoutConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double

    fun timeOfNextConflict(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double

    fun analyseConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): ConflictProperties
}

fun detectConflicts(trainRequirements: List<TrainRequirements>): List<Conflict> {
    val res = incrementalConflictDetector(trainRequirements).checkConflicts()
    return mergeConflicts(res)
}

fun incrementalConflictDetector(
    trainRequirements: List<TrainRequirements>
): IncrementalConflictDetector {
    return IncrementalConflictDetectorImpl(trainRequirements)
}

interface SpacingTrainRequirement {
    val trainId: Long
    val spacingRequirements: Collection<SpacingRequirement>
}

interface RoutingTrainRequirement {
    val trainId: Long
    val routingRequirements: Collection<RoutingRequirement>
}

interface ResourceRequirement {
    val beginTime: Double
    val endTime: Double
}

class TrainRequirements(
    @Json(name = "train_id")
    override val trainId: Long, // Not the usual RJS ids, but an actual DB id
    @Json(name = "spacing_requirements")
    override val spacingRequirements: Collection<SpacingRequirement>,
    @Json(name = "routing_requirements")
    override val routingRequirements: Collection<RoutingRequirement>,
) : SpacingTrainRequirement, RoutingTrainRequirement

data class Conflict(
    val trainIds: Collection<Long>,
    val startTime: Double,
    val endTime: Double,
    val conflictType: ConflictType
)

enum class ConflictType {
    SPACING,
    ROUTING,
}

data class ConflictProperties(
    // If there are conflicts, minimum delay that should be added to the train so that there are no
    // conflicts anymore
    val minDelayWithoutConflicts: Double,
    // If there are no conflicts, maximum delay that can be added to the train without creating any
    // conflict
    val maxDelayWithoutConflicts: Double,
    // If there are no conflicts, minimum begin time of the next requirement that could conflict
    val timeOfNextConflict: Double
)

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
        val requirements = spacingZoneRequirements[req.zone] ?: return listOf()

        val res = mutableListOf<Conflict>()
        for (otherReq in requirements) {
            val beginTime = max(req.beginTime, otherReq.beginTime)
            val endTime = min(req.endTime, otherReq.endTime)
            if (beginTime < endTime)
                res.add(
                    Conflict(listOf(otherReq.trainId), beginTime, endTime, ConflictType.SPACING)
                )
        }

        return res
    }

    override fun checkRoutingRequirement(req: RoutingRequirement): List<Conflict> {
        val res = mutableListOf<Conflict>()
        for (zoneReq in req.zones) {
            val zoneReqConfig =
                RoutingZoneConfig(zoneReq.entryDetector, zoneReq.exitDetector, zoneReq.switches!!)
            val requirements = routingZoneRequirements[zoneReq.zone!!] ?: continue

            for (otherReq in requirements) {
                if (otherReq.config == zoneReqConfig) continue
                val beginTime = max(req.beginTime, otherReq.beginTime)
                val endTime = min(zoneReq.endTime, otherReq.endTime)
                if (beginTime < endTime)
                    res.add(
                        Conflict(listOf(otherReq.trainId), beginTime, endTime, ConflictType.ROUTING)
                    )
            }
        }
        return res
    }

    override fun analyseConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): ConflictProperties {
        val minDelayWithoutConflicts =
            minDelayWithoutConflicts(spacingRequirements, routingRequirements)
        if (minDelayWithoutConflicts != 0.0) { // There are initial conflicts
            return ConflictProperties(minDelayWithoutConflicts, 0.0, 0.0)
        } else { // There are no initial conflicts
            var maxDelay = Double.POSITIVE_INFINITY
            var timeOfNextConflict = Double.POSITIVE_INFINITY
            for (spacingRequirement in spacingRequirements) {
                if (spacingZoneRequirements[spacingRequirement.zone!!] != null) {
                    val endTime = spacingRequirement.endTime
                    for (requirement in spacingZoneRequirements[spacingRequirement.zone!!]!!) {
                        if (endTime <= requirement.beginTime) {
                            maxDelay = min(maxDelay, requirement.beginTime - endTime)
                            timeOfNextConflict = min(timeOfNextConflict, requirement.beginTime)
                        }
                    }
                }
            }
            for (routingRequirement in routingRequirements) {
                for (zoneReq in routingRequirement.zones) {
                    if (routingZoneRequirements[zoneReq.zone!!] != null) {
                        val endTime = zoneReq.endTime
                        val config =
                            RoutingZoneConfig(
                                zoneReq.entryDetector,
                                zoneReq.exitDetector,
                                zoneReq.switches!!
                            )
                        for (requirement in routingZoneRequirements[zoneReq.zone!!]!!) {
                            if (endTime <= requirement.beginTime && config != requirement.config) {
                                maxDelay = min(maxDelay, requirement.beginTime - endTime)
                                timeOfNextConflict = min(timeOfNextConflict, requirement.beginTime)
                            }
                        }
                    }
                }
            }
            return ConflictProperties(minDelayWithoutConflicts, maxDelay, timeOfNextConflict)
        }
    }

    override fun minDelayWithoutConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double {
        var globalMinDelay = 0.0
        while (globalMinDelay.isFinite()) {
            var minDelay = 0.0
            for (spacingRequirement in spacingRequirements) {
                if (spacingZoneRequirements[spacingRequirement.zone!!] != null) {
                    val conflictingRequirements =
                        spacingZoneRequirements[spacingRequirement.zone!!]!!.filter {
                            !(spacingRequirement.beginTime >= it.endTime ||
                                spacingRequirement.endTime <= it.beginTime)
                        }
                    if (conflictingRequirements.isNotEmpty()) {
                        val latestEndTime = conflictingRequirements.maxOf { it.endTime }
                        minDelay = max(minDelay, latestEndTime - spacingRequirement.beginTime)
                    }
                }
            }
            for (routingRequirement in routingRequirements) {
                for (zoneReq in routingRequirement.zones) {
                    if (routingZoneRequirements[zoneReq.zone!!] != null) {
                        val config =
                            RoutingZoneConfig(
                                zoneReq.entryDetector,
                                zoneReq.exitDetector,
                                zoneReq.switches!!
                            )
                        val conflictingRequirements =
                            routingZoneRequirements[zoneReq.zone!!]!!.filter {
                                !(routingRequirement.beginTime >= it.endTime ||
                                    zoneReq.endTime <= it.beginTime) && config != it.config
                            }
                        if (conflictingRequirements.isNotEmpty()) {
                            val latestEndTime = conflictingRequirements.maxOf { it.endTime }
                            minDelay = max(minDelay, latestEndTime - routingRequirement.beginTime)
                        }
                    }
                }
            }
            // No new conflicts
            if (minDelay == 0.0) return globalMinDelay

            // Check for conflicts with newly added delay
            globalMinDelay += minDelay
            spacingRequirements.onEach {
                it.beginTime += minDelay
                it.endTime += minDelay
            }
            routingRequirements.onEach { routingRequirement ->
                routingRequirement.beginTime += minDelay
                routingRequirement.zones.onEach { it.endTime += minDelay }
            }
        }
        return Double.POSITIVE_INFINITY
    }

    override fun maxDelayWithoutConflicts(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double {
        return analyseConflicts(spacingRequirements, routingRequirements).maxDelayWithoutConflicts
    }

    override fun timeOfNextConflict(
        spacingRequirements: List<SpacingRequirement>,
        routingRequirements: List<RoutingRequirement>
    ): Double {
        return analyseConflicts(spacingRequirements, routingRequirements).timeOfNextConflict
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
