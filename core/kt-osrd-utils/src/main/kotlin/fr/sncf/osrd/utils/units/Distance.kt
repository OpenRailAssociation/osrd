@file:PrimitiveWrapperCollections(
    wrapper = Distance::class,
    primitive = Long::class,
    fromPrimitive = "Distance(%s)",
    toPrimitive = "%s.millimeters",
    collections = ["Array", "ArrayList", "RingBuffer"],
)

@file:PrimitiveWrapperCollections(
    wrapper = Offset::class,
    primitive = Long::class,
    fromPrimitive = "Offset(Distance(%s))",
    toPrimitive = "%s.distance.millimeters",
    collections = ["Array", "ArrayList", "RingBuffer"],
)

package fr.sncf.osrd.utils.units

import fr.sncf.osrd.fast_collections.PrimitiveWrapperCollections
import kotlin.math.absoluteValue

@JvmInline
value class Distance(val millimeters: Long) : Comparable<Distance> {
    val absoluteValue get() = Distance(millimeters.absoluteValue)
    val meters get() = millimeters / 1000.0
    operator fun plus(value: Distance): Distance {
        return Distance(millimeters + value.millimeters)
    }

    operator fun minus(value: Distance): Distance {
        return Distance(millimeters - value.millimeters)
    }

    companion object {
        @JvmStatic
        val ZERO = Distance(millimeters = 0L)
        @JvmStatic
        @JvmName("fromMeters")
        fun fromMeters(meters: Double) = Distance(millimeters = (Math.round(meters * 1_000.0)))
        @JvmStatic
        @JvmName("toMeters")
        fun toMeters(distance: Distance) = distance.meters
    }

    override fun compareTo(other: Distance): Int {
        return millimeters.compareTo(other.millimeters)
    }

    operator fun unaryMinus(): Distance {
        return Distance(-millimeters)
    }

    /** This is just used for clearer display in debugging windows */
    override fun toString(): String {
        val meters = millimeters / 1000
        val decimal = (millimeters % 1000).absoluteValue
        if (decimal == 0L)
            return String.format("%sm", meters)
        else
            return String.format("%s.%sm", meters, decimal)
    }
}

val Double.meters: Distance get() = Distance.fromMeters(this)
val Int.meters: Distance get() = Distance(this.toLong() * 1000)


@JvmInline
value class Offset<T>(val distance: Distance) : Comparable<Offset<T>> {
    operator fun plus(value: Distance): Offset<T> {
        return Offset(distance + value)
    }

    operator fun minus(value: Distance): Offset<T> {
        return Offset(distance - value)
    }

    operator fun minus(value: Offset<T>): Distance {
        return distance - value.distance
    }

    override fun compareTo(other: Offset<T>): Int {
        return distance.compareTo(other.distance)
    }

    override fun toString(): String {
        return distance.toString()
    }
}

typealias Length<T> = Offset<T>
