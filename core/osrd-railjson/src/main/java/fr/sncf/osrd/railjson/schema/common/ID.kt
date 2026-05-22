package fr.sncf.osrd.railjson.schema.common

import com.squareup.moshi.*
import java.io.IOException
import java.lang.reflect.Type

data class ID<T : Identified>(@JvmField var id: String) {
    /** A moshi adapter for ID serialization */
    class Adapter<T : Identified> : JsonAdapter<ID<T>?>() {
        private fun factory(
            type: Type,
            annotations: MutableSet<out Annotation>,
            moshi: Moshi,
        ): JsonAdapter<*>? {
            // the raw type is the one without a type parameter
            val rawType = Types.getRawType(type)
            if (!annotations.isEmpty()) return null

            // if the type of the objects to adapt isn't something the factory can produce adapters
            // for, return null to tell the frame
            if (rawType != ID::class.java) return null

            return this
        }

        @Throws(IOException::class)
        override fun fromJson(reader: JsonReader): ID<T> {
            return ID(reader.nextString())
        }

        @Throws(IOException::class)
        override fun toJson(writer: JsonWriter, value: ID<T>?) {
            if (value != null) writer.value(value.id) else writer.nullValue()
        }

        companion object {
            @JvmField
            val FACTORY: Factory =
                Factory { type: Type, annotations: MutableSet<out Annotation>, moshi: Moshi ->
                    Adapter<Identified>().factory(type, annotations, moshi)
                }
        }
    }

    companion object {
        fun <T : Identified> from(obj: T): ID<T> {
            return ID(obj.id)
        }
    }
}
