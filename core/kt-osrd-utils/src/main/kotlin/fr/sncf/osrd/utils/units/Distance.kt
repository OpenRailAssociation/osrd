@file:PrimitiveWrapperCollections(
    wrapper = Distance::class,
    primitive = Long::class,
    fromPrimitive = "Distance(%s)",
    toPrimitive = "%s.millimeters",
    collections = ["Array", "ArrayList"],
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
        fun fromMeters(meters: Double) = Distance(millimeters = (meters * 1_000.0).toLong())
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

val Double.meters: Distance get() = Distance((this * 1000).toLong())
val Int.meters: Distance get() = Distance(this.toLong() * 1000)
