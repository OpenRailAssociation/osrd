package fr.sncf.osrd.utils.json

import com.squareup.moshi.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type

/**
 * Utility class, used to put Distances directly in json-adaptable classes. A value of type `long`
 * will be expected, representing millimeters.
 */
class DistanceAdapter : JsonAdapter<Distance>() {
    @FromJson
    override fun fromJson(reader: JsonReader): Distance {
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
class OffsetAdapter<T> : JsonAdapter<Offset<T>>() {
    @FromJson
    override fun fromJson(reader: JsonReader): Offset<T> {
        return Offset(Distance(millimeters = reader.nextLong()))
    }

    @ToJson
    override fun toJson(writer: JsonWriter, value: Offset<T>?) {
        writer.value(value?.distance?.millimeters)
    }
}

/** Adapter factory, to be added in moshi builder */
class DistanceAdapterFactory : JsonAdapter.Factory {
    override fun create(type: Type, annotations: Set<Annotation>, moshi: Moshi): JsonAdapter<*>? {
        if (annotations.isNotEmpty()) return null
        if (type === Distance::class.java) return DistanceAdapter()
        return null
    }
}

/** Adapter factory, to be added in moshi builders */
class OffsetAdapterFactory : JsonAdapter.Factory {
    override fun create(
        type: Type,
        annotations: MutableSet<out Annotation>,
        moshi: Moshi
    ): JsonAdapter<*>? {
        val rawType = Types.getRawType(type)
        if (rawType == Offset::class.java && type is ParameterizedType) {
            return OffsetAdapter<Any>()
        }
        return null
    }
}
