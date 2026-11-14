package fr.sncf.osrd.trainsim

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.path.interfaces.DirChunkRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.utils.Direction
import java.io.Closeable
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonArray
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

interface RecordableRegulator : Regulator {
    fun recordHeader(train: Int): JsonObject

    fun recordTick(train: Int): JsonObject
}

class SimRecorder(
    file: File,
    private val trains: List<ScheduledTrain>,
    private val regulator: RecordableRegulator,
) : Closeable {
    private val writer = file.bufferedWriter()

    init {
        try {
            writeLine(
                buildJsonObject {
                    put("type", "header")
                    putJsonArray("trains") {
                        for ((i, train) in trains.withIndex()) {
                            addJsonObject {
                                put("departure", train.departure.seconds)
                                put("pathLength", train.simulator.context.path.length)
                                putAll(regulator.recordHeader(i))
                            }
                        }
                    }
                },
            )
        } catch (e: Throwable) {
            writer.close()
            throw e
        }
    }

    fun record() {
        writeLine(
            buildJsonObject {
                put("type", "tick")
                putJsonArray("trains") {
                    for ((i, train) in trains.withIndex()) {
                        val state = train.simulator.state
                        addJsonObject {
                            put("time", (train.departure + state.time).seconds)
                            put("position", state.position.meters)
                            put("speed", state.speed.metersPerSecond)
                            putAll(regulator.recordTick(i))
                        }
                    }
                }
            },
        )
    }

    private fun writeLine(line: JsonObject) {
        writer.write(line.toString())
        writer.newLine()
        writer.flush()
    }

    override fun close() = writer.close()

    companion object {
        private val fileNameTime = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH-mm-ss-SSS")

        fun fromEnv(trains: List<ScheduledTrain>, regulator: RecordableRegulator): SimRecorder? {
            val dir = File(System.getenv("MULTITRAIN_RECORD_DIR") ?: return null)
            dir.mkdirs()
            val name = "multitrain-${LocalDateTime.now().format(fileNameTime)}.jsonl"
            return SimRecorder(dir.resolve(name), trains, regulator)
        }
    }
}

private fun JsonObjectBuilder.putAll(fields: JsonObject) {
    for ((key, value) in fields) put(key, value)
}

internal fun pathGeometryJson(rawInfra: RawInfra, path: TrainPath) = buildJsonArray {
    for (point in pathGeometry(rawInfra, path)) {
        addJsonArray {
            add(point.lon)
            add(point.lat)
            add(point.pathOffset)
        }
    }
}

private data class GeoPoint(val lon: Double, val lat: Double, val pathOffset: Double)

private fun pathGeometry(rawInfra: RawInfra, path: TrainPath): List<GeoPoint> {
    val trackDrawings = mutableMapOf<TrackSectionId, LineString>()
    val points = mutableListOf<GeoPoint>()
    for (range in path.getChunks()) {
        val track = rawInfra.getTrackFromChunk(range.value.value)
        val trackDrawing =
            trackDrawings.getOrPut(track) {
                LineString.concatenate(
                    rawInfra.getTrackSectionChunks(track).map { rawInfra.getTrackChunkGeom(it) },
                )
            }
        val drawing = chunkDrawing(rawInfra, range, trackDrawing)
        val rangeStart = range.pathBegin.meters
        val rangeLength = (range.pathEnd - range.pathBegin).meters
        for ((i, point) in drawing.getPoints().withIndex()) {
            // drawings repeat the points where chunks meet, in a track and between consecutive ones
            val last = points.lastOrNull()
            if (last != null && last.lon == point.lon && last.lat == point.lat) continue
            // cumulativeLengths[i - 1] is the drawn distance from the first point to point i
            val drawnFraction =
                if (i == 0 || drawing.length == 0.0) 0.0
                else drawing.cumulativeLengths[i - 1] / drawing.length
            points.add(GeoPoint(point.lon, point.lat, rangeStart + drawnFraction * rangeLength))
        }
    }
    return points
}

private fun chunkDrawing(
    rawInfra: RawInfra,
    range: DirChunkRange,
    trackDrawing: LineString,
): LineString {
    val chunk = range.value.value
    val trackLength = rawInfra.getTrackSectionLength(rawInfra.getTrackFromChunk(chunk)).meters
    val chunkStart = rawInfra.getTrackChunkOffset(chunk).meters
    val chunkEnd = chunkStart + rawInfra.getTrackChunkLength(chunk).meters
    fun fraction(trackOffset: Double) = (trackOffset / trackLength).coerceIn(0.0, 1.0)

    if (range.value.direction == Direction.INCREASING) {
        return trackDrawing.slice(
            fraction(chunkStart + range.objectBegin.meters),
            fraction(chunkStart + range.objectEnd.meters),
        )
    }
    // going backwards, object offsets are counted from the chunk end
    return trackDrawing
        .slice(
            fraction(chunkEnd - range.objectEnd.meters),
            fraction(chunkEnd - range.objectBegin.meters),
        )
        .reverse()
}
