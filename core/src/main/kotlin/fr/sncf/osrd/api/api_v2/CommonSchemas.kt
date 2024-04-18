package fr.sncf.osrd.api.api_v2

import com.squareup.moshi.*
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import java.time.LocalDateTime

data class TrackRange(
    @Json(name = "track_section") val trackSection: String,
    var begin: Offset<TrackSection>,
    var end: Offset<TrackSection>,
    val direction: EdgeDirection,
)

/**
 * Dates can be typed as `LocalDateTime` in json compatible types, with this adapter it will be
 * converted to/from ISO8601 strings
 */
class DateAdapter : JsonAdapter<LocalDateTime>() {
    @FromJson
    override fun fromJson(reader: JsonReader): LocalDateTime {
        return LocalDateTime.parse(reader.nextString())
    }

    @ToJson
    override fun toJson(writer: JsonWriter, value: LocalDateTime?) {
        writer.value(value?.toString())
    }
}

class RangeValues<T>(val boundaries: List<Distance>, val values: List<T>)
