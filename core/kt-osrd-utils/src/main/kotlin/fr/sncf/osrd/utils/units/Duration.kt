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
    
    override fun toString(): String {
        val seconds = milliseconds / 1000
        val decimal = (milliseconds % 1000).absoluteValue
        if (decimal == 0L)
            return String.format("%ss", seconds)
        else
            return String.format("%s.%ss",seconds,decimal)
    }

    companion object {
        @JvmStatic
        val ZERO = Duration(milliseconds = 0L)
        @JvmStatic
        @JvmName("fromSeconds")
        fun fromSeconds(time: Double): Duration = time.seconds
        @JvmStatic
        @JvmName("toSeconds")
        fun fromSeconds(time: Duration): Double = time.seconds
    }

    override fun compareTo(other: Duration): Int {
        return milliseconds.compareTo(other.milliseconds)
    }
}
 
val Double.seconds: Duration get() = Duration((this * 1000).toLong())
val Int.seconds: Duration get() = Duration(this.toLong() * 1000)
