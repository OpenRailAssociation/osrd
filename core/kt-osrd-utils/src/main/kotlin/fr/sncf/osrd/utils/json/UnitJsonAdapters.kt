package fr.sncf.osrd.utils.json

import com.squareup.moshi.*
import fr.sncf.osrd.utils.units.*
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * Utility class, used to put Distances directly in json-adaptable classes. A value of type `long`
 * will be expected, representing millimeters.
 */
class DistanceAdapter : JsonAdapter<Distance?>() {
    @FromJson
    override fun fromJson(reader: JsonReader): Distance? {
        if (reader.peek() == JsonReader.Token.NULL) {
            reader.skipValue()
            return null
        }
        return Distance(millimeters = reader.nextLong())
    }

    @ToJson
    override fun toJson(writer: JsonWriter, value: Distance?) {
        writer.value(value?.millimeters)
    }
}

/**
 * Utility class, used to put Offsets and Lengths directly in json-adaptable classes. A value of
 * type `long` will be expected, representing millimeters.
 */
class OffsetAdapter<T> : JsonAdapter<Offset<T>?>() {
    @FromJson
    override fun fromJson(reader: JsonReader): Offset<T>? {
        if (reader.peek() == JsonReader.Token.NULL) {
            reader.skipValue()
            return null
        }
        return Offset(Distance(millimeters = reader.nextLong()))
    }

    @ToJson
    override fun toJson(writer: JsonWriter, value: Offset<T>?) {
        writer.value(value?.distance?.millimeters)
    }
}

/**
 * Utility class, used to put Speeds directly in json-adaptable classes. A value of type `double`
 * will be expected, representing meters per second.
 */
class SpeedAdapter : JsonAdapter<Speed?>() {
    @FromJson
    override fun fromJson(reader: JsonReader): Speed? {
        if (reader.peek() == JsonReader.Token.NULL) {
            reader.skipValue()
            return null
        }
        return reader.nextDouble().metersPerSecond
    }

    @ToJson
    override fun toJson(writer: JsonWriter, value: Speed?) {
        writer.value(value?.metersPerSecond)
    }
}

/**
 * Utility class, used to put Durations directly in json-adaptable classes. A value of type `long`
 * will be expected, representing milliseconds.
 */
class DurationAdapter : JsonAdapter<Duration?>() {
    @FromJson
    override fun fromJson(reader: JsonReader): Duration? {
        if (reader.peek() == JsonReader.Token.NULL) {
            reader.skipValue()
            return null
        }
        return Duration(milliseconds = reader.nextLong())
    }

    @ToJson
    override fun toJson(writer: JsonWriter, value: Duration?) {
        writer.value(value?.milliseconds)
    }
}

/**
 * Dates can be typed as `ZonedDateTime` in json compatible types, with this adapter it will be
 * converted to/from ISO8601 strings
 */
class DateAdapter : JsonAdapter<ZonedDateTime>() {
    @FromJson
    override fun fromJson(reader: JsonReader): ZonedDateTime? {
        if (reader.peek() == JsonReader.Token.NULL) {
            reader.skipValue()
            return null
        }
        return ZonedDateTime.parse(reader.nextString())
    }

    @ToJson
    override fun toJson(writer: JsonWriter, value: ZonedDateTime?) {
        writer.value(value?.format(DateTimeFormatter.ISO_INSTANT))
    }
}

/** Adapter factory, to be added in moshi builder */
class UnitAdapterFactory : JsonAdapter.Factory {
    override fun create(type: Type, annotations: Set<Annotation>, moshi: Moshi): JsonAdapter<*>? {
        if (annotations.isNotEmpty()) return null
        if (type === Duration::class.java) return DurationAdapter()
        if (type === Distance::class.java) return DistanceAdapter()
        if (type === ZonedDateTime::class.java) return DateAdapter()
        if (type === Speed::class.java) return SpeedAdapter()
        val rawType = Types.getRawType(type)
        if (rawType == Offset::class.java && type is ParameterizedType) {
            return OffsetAdapter<Any>()
        }
        return null
    }
}
