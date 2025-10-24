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
import fr.sncf.osrd.utils.Direction
import kotlin.math.absoluteValue

/**
 * Describes a distance.
 *
 * This is an inlined value class: the JVM sees this as a simple Long. When interfacing with Java or
 * other languages, this is typed as a Long and the unit is millimeters.
 *
 * When this appears in a JSON payload, the unit is millimeters typed as a Long.
 */
@JvmInline
value class Distance(val millimeters: Long) : Comparable<Distance> {
    val absoluteValue
        get() = Distance(millimeters.absoluteValue)

    val meters
        get() = millimeters / 1000.0

    operator fun plus(value: Distance): Distance {
        return Distance(millimeters + value.millimeters)
    }

    operator fun minus(value: Distance): Distance {
        return Distance(millimeters - value.millimeters)
    }

    companion object {
        val ZERO = Distance(millimeters = 0L)
        val MAX = Distance(millimeters = Long.MAX_VALUE)

        fun fromMeters(meters: Double) = Distance(millimeters = (Math.round(meters * 1_000.0)))

        fun toMeters(distance: Distance) =
            distance.meters // Only meant to be used in java, for compatibility

        fun min(a: Distance, b: Distance) =
            Distance(millimeters = a.millimeters.coerceAtMost(b.millimeters))

        fun max(a: Distance, b: Distance) =
            Distance(millimeters = a.millimeters.coerceAtLeast(b.millimeters))
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
        if (decimal == 0L) return String.format("%sm", meters)
        else return String.format("%s.%sm", meters, decimal)
    }

    operator fun div(d: Double): Distance = Distance(Math.round(millimeters / d))

    operator fun div(distance: Distance): Double =
        millimeters.toDouble() / distance.millimeters.toDouble()

    operator fun times(d: Double): Distance = Distance(Math.round(millimeters * d))
}

val Double.meters: Distance
    get() = Distance.fromMeters(this)
val Int.meters: Distance
    get() = Distance(this.toLong() * 1000)

/**
 * Describes an offset on a given object. Typing is strictly enforced and mismatches will fail to
 * compile, though `.cast<T>()` can be used.
 *
 * This is an inlined value class: the JVM sees this as a simple Long. When interfacing with Java or
 * other languages, this is typed as a Long and the unit is millimeters.
 *
 * When this appears in a JSON payload, the unit is millimeters typed as a Long.
 *
 * Note: projecting an offset from one object to another is an error-prone operation when done by
 * hand, it's recommended to heavily factorize and test such code. "Train path" classes are
 * generally meant to handle such projection.
 */
@JvmInline
value class Offset<T>(val distance: Distance) : Comparable<Offset<T>> {
    val meters: Double
        get() = distance.meters

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

    /**
     * Utility function to convert an offset type to another. It still needs to be called
     * explicitly, but avoids verbose syntaxes on conversions
     */
    fun <U> cast(): Offset<U> = Offset(distance)

    operator fun div(d: Double): Offset<T> = Offset(distance / d)

    operator fun times(d: Double): Offset<T> = Offset(distance * d)

    companion object {
        fun <T> zero() = Offset<T>(Distance.ZERO)

        fun <T> min(a: Offset<T>, b: Offset<T>) = Offset<T>(Distance.min(a.distance, b.distance))

        fun <T> max(a: Offset<T>, b: Offset<T>) = Offset<T>(Distance.max(a.distance, b.distance))
    }
}

fun <T> OffsetArray<T>.binarySearch(offset: Offset<T>): Int {
    return binarySearch(offset) { a, b -> (a - b).millimeters.toInt() }
}

/**
 * Given an array of segment boundaries, return the index of the segment which contains the given
 * offset. When the offset is a segment boundary, returns the index of the first encountered segment
 * along the provided direction.
 *
 * For example, if there are two segments, one from offset 2 to 4, and one from 4 to 6, their
 * boundary array is [2, 4, 6]. The following statements are true:
 * - findSegment(1, INCREASING) == -1 // out of bounds
 * - findSegment(2, INCREASING) == 0
 * - findSegment(2, DECREASING) == 0
 * - findSegment(3, INCREASING) == 0
 * - findSegment(3, DECREASING) == 0
 * - findSegment(4, INCREASING) == 0
 * - findSegment(4, DECREASING) == 1
 */
fun <T> OffsetArray<T>.findSegment(offset: Offset<T>, direction: Direction): Int {
    val sectionCount = size - 1

    if (offset < Offset(0.meters) || offset > this[sectionCount]) return -1
    val boundIndex = binarySearch(offset)

    // the position falls exactly on a boundary
    if (boundIndex >= 0) {
        if (boundIndex == 0) return 0
        if (boundIndex == sectionCount) return sectionCount - 1
        return when (direction) {
            Direction.INCREASING -> boundIndex - 1
            Direction.DECREASING -> boundIndex
        }
    }

    // the position falls within a section
    val insertionPos = -(boundIndex + 1)
    assert(insertionPos in 1..sectionCount)
    return insertionPos - 1
}

typealias Length<T> = Offset<T>

/** Utility method to sum distances streams */
fun Collection<Distance>.sumDistances(): Distance {
    return Distance(millimeters = sumOf { it.millimeters })
}

/** Utility method to sum offset streams */
fun <T> Collection<Offset<T>>.sumOffsets(): Offset<T> {
    return Offset(Distance(millimeters = sumOf { it.distance.millimeters }))
}
