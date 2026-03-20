package fr.sncf.osrd.cli

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.DirTrackSectionId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.TrackNodeConfigId
import fr.sncf.osrd.sim_infra.api.TrackNodeId
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.utils.CSVLogger
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import kotlin.math.max
import kotlin.math.min

data class NodeStats(
    val goodConfigs: Set<TrackNodeConfigId>,
    val badConfigs: Set<TrackNodeConfigId>,
    val geo: Point,
    var goodConfigCount: Int = 0,
    var badConfigCount: Int = 0,
) {
    fun register(config: TrackNodeConfigId) {
        if (goodConfigs.contains(config)) goodConfigCount++
        else {
            assert(badConfigs.contains(config))
            badConfigCount++
        }
    }
}

val allNodeStats = mutableMapOf<TrackNodeId, NodeStats>()

fun logAllNodes() {
    val logger =
        CSVLogger("node_stats.csv", "good_configs", "bad_configs", "good_ratio", "lat", "lon")
    for (stats in allNodeStats.values) {
        logger.log(
            "good_configs" to stats.goodConfigCount,
            "bad_configs" to stats.badConfigCount,
            "good_ratio" to
                stats.goodConfigCount.toDouble() /
                    (stats.goodConfigCount + stats.badConfigCount).toDouble(),
            "lat" to stats.geo.lat,
            "lon" to stats.geo.lon,
        )
    }
}

fun getTrackGeo(rawInfra: RawInfra, dirTrack: DirStaticIdx<TrackSection>): LineString {
    val track = dirTrack.value
    val chunks = rawInfra.getTrackSectionChunks(track)
    val geo = LineString.concatenate(chunks.map { rawInfra.getTrackChunkGeom(it) })
    return if (dirTrack.direction == Direction.INCREASING) geo else geo.reverse()
}

fun getFirstPoint(geo: LineString): Point {
    val dist = min(geo.length, 10.0)
    val normalized = if (geo.length == 0.0) 0.0 else dist / geo.length
    return geo.interpolateNormalized(normalized)
}

fun getLastPoint(geo: LineString): Point {
    val dist = max(0.0, geo.length - 10.0)
    val normalized = if (geo.length == 0.0) 0.0 else dist / geo.length
    return geo.interpolateNormalized(normalized)
}

fun foo(rawInfra: RawInfra, blockInfra: BlockInfra) {

    if (false) {
        val speedLogger = CSVLogger("speed_limits.csv", "geo", "kmh")
        for (track in rawInfra.trackSections) {
            for (chunk in rawInfra.getTrackSectionChunks(track)) {
                val geo = rawInfra.getTrackChunkGeom(chunk)
                val chunkLength = rawInfra.getTrackChunkLength(chunk)
                val speeds =
                    rawInfra.getTrackChunkSpeedLimitProperties(
                        DirTrackChunkId(chunk, Direction.INCREASING),
                        null,
                        null,
                    )
                for (entry in speeds) {
                    val speedGeo =
                        geo.slice(
                            entry.lower.meters / chunkLength.meters,
                            entry.upper.meters / chunkLength.meters,
                        )
                    speedLogger.log(
                        "geo" to speedGeo,
                        "kmh" to min(400, entry.value.speed.kilometersPerHour),
                    )
                }
            }
        }
    } else {

        val usedConfigs =
            mutableMapOf<Pair<TrackNodeId, TrackNodeConfigId>, MutableSet<DirTrackSectionId>>()
        for (block in blockInfra.blocks) {
            for (zonePath in blockInfra.getBlockZonePaths(block)) {
                val switches = rawInfra.getZonePathMovableElements(zonePath)
                val switchConfigs = rawInfra.getZonePathMovableElementsConfigs(zonePath)
                for ((switch, config) in switches zip switchConfigs) {
                    val set = usedConfigs.getOrPut(Pair(switch, config)) { mutableSetOf() }
                    set.addAll(
                        blockInfra.getTrackChunksFromBlock(block).map {
                            DirTrackSectionId(rawInfra.getTrackFromChunk(it.value), it.direction)
                        }
                    )
                }
            }
        }

        data class Link(val from: DirTrackSectionId, val to: DirTrackSectionId, val used: Boolean)

        val links = mutableSetOf<Link>()
        for (node in rawInfra.trackNodes) {
            if (rawInfra.getTrackNodeConfigs(node).size < 2U) continue
            val goodConfigs = mutableSetOf<TrackNodeConfigId>()
            val badConfigs = mutableSetOf<TrackNodeConfigId>()
            val ports = rawInfra.getTrackNodePorts(node)
            var geo: Point? = null
            for (config in rawInfra.getTrackNodeConfigs(node)) {
                for (port in ports) {
                    val connection = rawInfra.getPortConnection(node, port)
                    val track = connection.value
                    val dirTrack = DirTrackSectionId(track, connection.endpoint.directionFrom)
                    val next = rawInfra.getNextTrackSection(dirTrack, config)
                    if (next.isNone) continue

                    val used = usedConfigs[Pair(node, config)]?.contains(dirTrack) ?: false

                    links.add(Link(dirTrack, next.asIndex(), used))

                    val number1 =
                        rawInfra.getTrackChunkTrackNumber(
                            rawInfra.getTrackSectionChunks(dirTrack.value).first()
                        )
                    val number2 =
                        rawInfra.getTrackChunkTrackNumber(
                            rawInfra.getTrackSectionChunks(next.asIndex().value).first()
                        )
                    if (number1 == number2) goodConfigs.add(config) else badConfigs.add(config)
                    geo = getTrackGeo(rawInfra, dirTrack).getPoints().last()
                }
            }
            if (goodConfigs.isNotEmpty() && badConfigs.isNotEmpty()) {
                allNodeStats[node] = NodeStats(goodConfigs, badConfigs, geo!!)
            }
        }

        if (false) {
            val logger =
                CSVLogger(
                    "connections.csv",
                    "geo",
                    "track_number_change",
                    "track1name",
                    "track2name",
                    "has_route",
                    "track_number_1",
                    "track_number_2",
                )
            for ((a, b, used) in links) {
                val name1 = rawInfra.getTrackSectionName(a.value)
                val name2 = rawInfra.getTrackSectionName(b.value)
                val number1 =
                    rawInfra.getTrackChunkTrackNumber(
                        rawInfra.getTrackSectionChunks(a.value).first()
                    )
                val number2 =
                    rawInfra.getTrackChunkTrackNumber(
                        rawInfra.getTrackSectionChunks(b.value).first()
                    )

                val geo1 = getTrackGeo(rawInfra, a)
                val geo2 = getTrackGeo(rawInfra, b)
                val p1 = getLastPoint(geo1)
                val p2 = getFirstPoint(geo2)

                val geo = "LINESTRING(${p1.lon} ${p1.lat}, ${p2.lon} ${p2.lat})"

                logger.log(
                    "geo" to geo,
                    "track_number_change" to (number1 != number2),
                    "track1name" to name1,
                    "track2name" to name2,
                    "has_route" to used,
                    "track_number_1" to number1!!,
                    "track_number_2" to number2!!,
                    flush = true,
                )
            }
        }
    }
}
