package fr.sncf.osrd.utils

import java.lang.ref.SoftReference
import kotlin.properties.ReadOnlyProperty
import kotlin.reflect.KProperty

/**
 * Usage: `val myValue by SoftLazy { computeValue() }`. The value is evaluated only when it's
 * actually accessed. It's then stored in a `SoftReference`, which may be cleared if the JVM needs
 * more RAM. Variables defined that way can then be used transparently, as if they were of type `T`.
 */
class SoftLazy<T>(private val computeValue: () -> T) : ReadOnlyProperty<Any?, T> {
    var cache: SoftReference<T> = SoftReference(null)

    override fun getValue(thisRef: Any?, property: KProperty<*>): T {
        return cache.get() ?: computeValue().also { cache = SoftReference(it) }
    }
}
