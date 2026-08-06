package fr.sncf.osrd.trainsim

import fr.sncf.osrd.conflicts.RoutingZoneConfig
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.TrackNodeId
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.api.getZonePathZone
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import kotlin.math.min

const val DEFAULT_APPROACH_BLOCKS: Double = 1.5

data class PathIntersection(
    val zone: ZoneId,
    val zoneEntry: Offset<PhysicsPath>,
    val zoneEnd: Offset<PhysicsPath>,
    val approachStart: Offset<PhysicsPath>,
    val config: RoutingZoneConfig,
)

// To not regulate straight track section junctions
fun RawInfra.isIntersection(node: TrackNodeId): Boolean = getTrackNodePorts(node).size > 2u

fun findPathIntersections(
    rawInfra: RawInfra,
    trainPath: TrainPath,
    approachBlocks: Double = DEFAULT_APPROACH_BLOCKS,
): List<PathIntersection> {
    val blocks = trainPath.getBlocks()
    val intersections = mutableListOf<PathIntersection>()

    for (range in trainPath.getZonePaths()) {
        val zonePath = range.value
        val nodes = rawInfra.getZonePathMovableElements(zonePath)
        val configs = rawInfra.getZonePathMovableElementsConfigs(zonePath)
        val positions = rawInfra.getZonePathMovableElementsPositions(zonePath)

        val met =
            nodes.indices.filter { i ->
                rawInfra.isIntersection(nodes[i]) &&
                        positions[i] >= range.objectBegin &&
                        positions[i] <= range.objectEnd
            }
        if (met.isEmpty()) continue

        val switches = met.associate { i ->
            rawInfra.getTrackNodeName(nodes[i]) to
                    rawInfra.getTrackNodeConfigName(nodes[i], configs[i])
        }

        intersections.add(
            PathIntersection(
                zone = rawInfra.getZonePathZone(zonePath),
                zoneEntry = range.pathBegin,
                zoneEnd = range.pathEnd,
                approachStart = approachStartOffset(blocks, range.pathBegin, approachBlocks),
                config =
                    RoutingZoneConfig(
                        entryDet = rawInfra.getZonePathEntry(zonePath),
                        exitDet = rawInfra.getZonePathExit(zonePath),
                        switches = switches,
                    ),
            )
        )
    }

    return intersections
}

internal fun approachStartOffset(
    blocks: List<BlockRange>,
    target: Offset<PhysicsPath>,
    approachBlocks: Double,
): Offset<PhysicsPath> {
    require(approachBlocks >= 0.0) { "can't approach an intersection over a negative distance" }

    var remaining = approachBlocks
    var offset = target

    for (block in blocks.reversed()) {
        if (remaining <= 0.0) break
        // only walk back over blocks the train goes through before the target
        if (block.pathEnd > target) continue

        val take = min(remaining, 1.0)
        val back = Distance(millimeters = (block.length.millimeters * take).toLong())
        offset -= back
        remaining -= take
    }

    return if (offset.distance.millimeters < 0) Offset(Distance(0)) else offset
}
