package fr.sncf.osrd.utils

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.PathfindingBlockSuccess
import fr.sncf.osrd.path.implementations.buildTrainPathFromChunkPath
import java.io.BufferedWriter
import java.io.File

/**
 * Export the track and waypoint geometry for a given path. Generate two csv files that can be
 * imported in QGIS for debugging purposes. Can be modified to include routes and blocks.
 */
fun exportPathGeo(infra: FullInfra, res: PathfindingBlockSuccess) {
    val name = res.hashCode()
    File("$name-tracks.csv").printWriter().use { out ->
        out.println("index;linestring;id")
        for ((i, track) in res.trackSectionRanges.withIndex()) {
            val chunkPath = makeChunkPath(infra.rawInfra, listOf(track))
            val pathProps =
                buildTrainPathFromChunkPath(
                    infra.rawInfra,
                    infra.blockInfra,
                    chunkPath,
                    routes = listOf(),
                )
            val geo = pathProps.getGeo()
            out.println("$i;$geo;${track.trackSection}")
        }
    }
    val fullChunkPath = makeChunkPath(infra.rawInfra, res.trackSectionRanges)
    val fullPath =
        buildTrainPathFromChunkPath(
            infra.rawInfra,
            infra.blockInfra,
            fullChunkPath,
            routes = listOf(),
        )
    val lineString = fullPath.getGeo()
    File("$name-points.csv").printWriter().use { out ->
        out.println("index;x;y")
        for ((i, item) in res.pathItemPositions.withIndex()) {
            val geo = lineString.interpolateNormalized(item.distance / fullPath.getLength())
            out.println("$i;${geo.lon};${geo.lat}")
        }
    }
}

/** Small utility class to log values in a csv */
class CSVLogger(filename: String, private val keys: List<String>) {
    private val writer: BufferedWriter = File(filename).bufferedWriter()

    init {
        writer.write(keys.joinToString(";") + "\n")
    }

    /** Log the given entries to the CSV. All keys must appear in the object keys. */
    fun log(entries: Map<String, Any>) {
        assert(entries.keys.all { keys.contains(it) })
        val line = keys.joinToString(separator = ";") { entries.getOrDefault(it, "").toString() }
        writer.write(line + "\n")
    }
}
