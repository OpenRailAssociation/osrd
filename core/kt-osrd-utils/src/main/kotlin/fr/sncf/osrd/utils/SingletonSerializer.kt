package fr.sncf.osrd.utils

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

class SingletonSerializer<T>(val getName: (T) -> String) : KSerializer<T> {
    override val descriptor = PrimitiveSerialDescriptor("SingletonSerializer", PrimitiveKind.STRING)
    val map = mutableMapOf<String, T>()

    fun register(singleton: T) {
        val name = getName(singleton)
        map[name] = singleton
    }

    override fun serialize(encoder: Encoder, value: T) {
        encoder.encodeString(getName(value))
    }

    override fun deserialize(decoder: Decoder): T {
        val name = decoder.decodeString()
        return map[name]!!
    }
}
