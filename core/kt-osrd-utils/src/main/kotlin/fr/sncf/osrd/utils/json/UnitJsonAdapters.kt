package fr.sncf.osrd.utils.json

import com.squareup.moshi.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Offset
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type

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

/** Adapter factory, to be added in moshi builder */
class UnitAdapterFactory : JsonAdapter.Factory {
    override fun create(type: Type, annotations: Set<Annotation>, moshi: Moshi): JsonAdapter<*>? {
        if (annotations.isNotEmpty()) return null
        if (type === Duration::class.java) return DurationAdapter()
        if (type === Distance::class.java) return DistanceAdapter()
        val rawType = Types.getRawType(type)
        if (rawType == Offset::class.java && type is ParameterizedType) {
            return OffsetAdapter<Any>()
        }
        return null
    }
}
