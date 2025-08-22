package fr.sncf.osrd.conflicts

import fr.sncf.osrd.api.RJSRoutingRequirement
import fr.sncf.osrd.api.RJSRoutingZoneRequirement
import fr.sncf.osrd.api.RJSSpacingRequirement
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.units.seconds

data class SpacingRequirement(
    val zone: ZoneId,
    val beginTime: Double,
    val endTime: Double,
    // whether the requirement end_time is final. it's metadata, and **shouldn't be used for
    // conflict detection**
    val isComplete: Boolean,
) {
    fun toRJS(infra: RawInfra): RJSSpacingRequirement {
        return RJSSpacingRequirement(infra.getZoneName(zone), beginTime.seconds, endTime.seconds)
    }

    companion object {
        fun fromRJS(input: RJSSpacingRequirement, infra: RawInfra): SpacingRequirement {
            return SpacingRequirement(
                infra.getZoneFromName(input.zone),
                input.beginTime.seconds,
                input.endTime.seconds,
                true,
            )
        }

        fun fromRJSWithAddedTime(
            input: RJSSpacingRequirement,
            infra: RawInfra,
            addedTime: Double,
        ): SpacingRequirement {
            return SpacingRequirement(
                infra.getZoneFromName(input.zone),
                input.beginTime.seconds + addedTime,
                input.endTime.seconds + addedTime,
                true,
            )
        }
    }
}

data class RoutingRequirement(
    val route: RouteId,
    val beginTime: Double,
    val zones: List<RoutingZoneRequirement>,
) {
    data class RoutingZoneRequirement(
        val zone: ZoneId,
        val entryDetector: DirDetectorId,
        val exitDetector: DirDetectorId,
        val switches: Map<String, String>,
        val endTime: Double,
    ) {
        fun toRJS(infra: RawInfra): RJSRoutingZoneRequirement {
            return RJSRoutingZoneRequirement(
                infra.getZoneName(zone),
                "${entryDetector.direction.name}:${infra.getDetectorName(entryDetector.value)}",
                "${exitDetector.direction.name}:${infra.getDetectorName(exitDetector.value)}",
                switches,
                endTime.seconds,
            )
        }

        companion object {
            fun fromRJS(input: RJSRoutingZoneRequirement, infra: RawInfra): RoutingZoneRequirement {
                fun parseDirDetector(id: String): DirDetectorId {
                    val split = id.split(":")
                    assert(split.size == 2)
                    return DirDetectorId(
                        infra.findDetector(split[1])!!,
                        Direction.valueOf(split[0]),
                    )
                }
                return RoutingZoneRequirement(
                    infra.getZoneFromName(input.zone),
                    parseDirDetector(input.entryDetector),
                    parseDirDetector(input.exitDetector),
                    input.switches,
                    input.endTime.seconds,
                )
            }
        }
    }

    fun toRJS(infra: RawInfra): RJSRoutingRequirement {
        return RJSRoutingRequirement(
            infra.getRouteName(route),
            beginTime.seconds,
            zones.map { it.toRJS(infra) },
        )
    }

    companion object {
        fun fromRJS(input: RJSRoutingRequirement, infra: RawInfra): RoutingRequirement {
            return RoutingRequirement(
                infra.getRouteFromName(input.route),
                input.beginTime.seconds,
                input.zones.map { RoutingZoneRequirement.fromRJS(it, infra) },
            )
        }
    }
}
