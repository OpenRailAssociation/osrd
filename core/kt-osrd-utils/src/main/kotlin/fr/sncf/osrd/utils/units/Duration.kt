package fr.sncf.osrd.utils.units

import fr.sncf.osrd.utils.toGroupedString
import kotlin.math.absoluteValue

/**
 * Describes a duration.
 *
 * This is an inlined value class: the JVM sees this as a simple Long. When interfacing with Java or
 * other languages, this is typed as a Long and the unit is milliseconds.
 *
 * When this appears in a JSON payload, the unit is milliseconds typed as a Long.
 */
@JvmInline
value class Duration(val milliseconds: Long) : Comparable<Duration> {

    val absoluteValue
        get() = Duration(milliseconds.absoluteValue)

    val seconds
        get() = milliseconds / 1000.0

    operator fun plus(value: Duration): Duration {
        return Duration(milliseconds + value.milliseconds)
    }

    operator fun minus(value: Duration): Duration {
        return Duration(milliseconds - value.milliseconds)
    }

    override fun toString(): String {
        val sign = if (milliseconds < 0) "-" else ""
        val abs = milliseconds.absoluteValue

        val days = abs / 86_400_000
        val hours = abs / 3_600_000 % 24
        val minutes = abs / 60_000 % 60
        val seconds = abs / 1_000 % 60
        val ms = abs % 1_000

        return buildString {
            append(sign)

            if (days > 0) {
                append("${days.toGroupedString()}T")
            }

            append("$hours".padStart(2, '0') + ":")
            append("$minutes".padStart(2, '0') + ":")
            append("$seconds".padStart(2, '0'))

            if (ms > 0) {
                append("." + "$ms".padStart(3, '0'))
            }
        }
    }

    companion object {
        val ZERO = Duration(milliseconds = 0L)

        fun fromSeconds(time: Double): Duration = time.seconds

        fun fromSeconds(time: Duration): Double = time.seconds
    }

    override fun compareTo(other: Duration): Int {
        return milliseconds.compareTo(other.milliseconds)
    }
}

val Double.seconds: Duration
    get() = Duration(Math.round(this * 1000))
val Long.microseconds: Duration
    get() = Duration(this / 1000)
val Int.seconds: Duration
    get() = Duration(this.toLong() * 1000)

typealias TimeDelta = Duration
