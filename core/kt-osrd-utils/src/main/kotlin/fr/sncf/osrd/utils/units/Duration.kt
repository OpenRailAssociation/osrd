package fr.sncf.osrd.utils.units

import kotlin.math.absoluteValue

@JvmInline
value class Duration(val milliseconds: Long) : Comparable<Duration> {

    val absoluteValue get() = Duration(milliseconds.absoluteValue)
    val seconds get() = milliseconds / 1000.0

    operator fun plus(value: Duration): Duration {
        return Duration(milliseconds + value.milliseconds)
    }

    operator fun minus(value: Duration): Duration {
        return Duration(milliseconds - value.milliseconds)
    }

    companion object {
        @JvmStatic
        val ZERO = Duration(milliseconds = 0L)
        fun fromSeconds(seconds: Double) = Duration(milliseconds = (seconds * 1_000.0).toLong())
    }

    override fun compareTo(other: Duration): Int {
        return milliseconds.compareTo(other.milliseconds)
    }
}
 
val Double.seconds: Duration get() = Duration((this * 1000).toLong())
val Int.seconds: Duration get() = Duration(this.toLong() * 1000)