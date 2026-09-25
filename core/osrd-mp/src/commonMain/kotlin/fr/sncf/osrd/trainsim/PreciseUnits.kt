package fr.sncf.osrd.trainsim

import fr.sncf.osrd.utils.signalingMinus
import fr.sncf.osrd.utils.signalingPlus
import fr.sncf.osrd.utils.signalingTimes
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import kotlin.jvm.JvmInline
import kotlin.math.absoluteValue

@JvmInline
value class PreciseDuration(val microseconds: Long) : Comparable<PreciseDuration> {
    val seconds: Double
        get() = microseconds.toDouble() / 1e6

    infix fun saturatedMinus(other: PreciseDuration): PreciseDuration =
        if (this <= other) 0.microseconds else this - other

    override fun toString(): String {
        val usec = (microseconds % 1_000_000).absoluteValue.toString().padStart(6, '0')
        val sec = ((microseconds / 1_000_000) % 60).absoluteValue.toString().padStart(2, '0')
        val min = ((microseconds / 60_000_000) % 60).absoluteValue.toString().padStart(2, '0')
        val hour = (microseconds / 3_600_000_000).absoluteValue
        val sign = if (microseconds < 0) "-" else ""
        return "$sign$hour:$min:$sec.$usec"
    }

    override fun compareTo(other: PreciseDuration): Int = microseconds.compareTo(other.microseconds)

    operator fun plus(other: PreciseDuration): PreciseDuration =
        PreciseDuration(microseconds = microseconds signalingPlus other.microseconds)

    operator fun minus(other: PreciseDuration): PreciseDuration =
        PreciseDuration(microseconds = microseconds signalingMinus other.microseconds)

    operator fun times(speed: PreciseSpeed): PreciseDistance =
        PreciseDistance(
            micrometers = (microseconds signalingTimes speed.micrometersPerSecond) / 1_000_000
        )

    operator fun times(distance: PreciseDistance): PreciseDiDu =
        PreciseDiDu(micrometersMicrosecond = microseconds signalingTimes distance.micrometers)

    operator fun times(duration: PreciseDuration): PreciseDuration2 =
        PreciseDuration2(microseconds2 = microseconds signalingTimes duration.microseconds)
}

val Double.seconds: PreciseDuration
    get() = PreciseDuration(microseconds = (this * 1e6).toLong())
val Int.microseconds: PreciseDuration
    get() = PreciseDuration(microseconds = this.toLong())

fun min(a: PreciseDistance, b: PreciseDistance): PreciseDistance = if (a < b) a else b

@JvmInline
value class PreciseDistance(val micrometers: Long) : Comparable<PreciseDistance> {
    val meters: Double
        get() = micrometers.toDouble() / 1e6

    val distance: Distance
        get() = Distance(millimeters = micrometers / 1000)

    override fun compareTo(other: PreciseDistance): Int = micrometers.compareTo(other.micrometers)

    override fun toString(): String {
        val um = (micrometers % 1_000_000).absoluteValue.toString().padStart(6, '0')
        val m = micrometers / 1_000_000
        return "$m.${um}m"
    }

    operator fun plus(other: PreciseDistance): PreciseDistance =
        PreciseDistance(micrometers = micrometers signalingPlus other.micrometers)

    /**
     * Compute the addition of `this` and [distance], returning [Long.MAX_VALUE] if it overflows.
     */
    infix fun saturatingAdd(distance: PreciseDistance): PreciseDistance {
        val sum = micrometers + distance.micrometers
        val saturatedSum =
            if ((sum < micrometers) == (distance.micrometers < 0)) {
                sum
            } else {
                Long.MAX_VALUE
            }
        return PreciseDistance(micrometers = saturatedSum)
    }

    operator fun minus(other: PreciseDistance): PreciseDistance =
        PreciseDistance(micrometers = micrometers signalingMinus other.micrometers)

    operator fun times(duration: PreciseDuration): PreciseDiDu =
        PreciseDiDu(micrometersMicrosecond = micrometers signalingTimes duration.microseconds)

    operator fun div(duration: PreciseDuration): PreciseSpeed =
        PreciseSpeed(
            micrometersPerSecond = (1_000_000L signalingTimes micrometers) / duration.microseconds
        )

    operator fun div(speed: PreciseSpeed): PreciseDuration =
        PreciseDuration(
            microseconds = (1_000_000L signalingTimes micrometers) / speed.micrometersPerSecond
        )

    operator fun div(unitless: Long): PreciseDistance =
        PreciseDistance(micrometers = micrometers / unitless)
}

operator fun Int.times(distance: PreciseDistance): PreciseDistance =
    PreciseDistance(micrometers = this.toLong() signalingTimes distance.micrometers)

val Double.meters: PreciseDistance
    get() = PreciseDistance(micrometers = (this * 1e6).toLong())
val Int.micrometers: PreciseDistance
    get() = PreciseDistance(micrometers = this.toLong())
val Long.micrometers: PreciseDistance
    get() = PreciseDistance(micrometers = this)

fun Distance.toPrecise(): PreciseDistance =
    PreciseDistance(micrometers = millimeters signalingTimes 1000)

fun <T> Offset<T>.toPrecise(): PreciseDistance =
    PreciseDistance(micrometers = distance.millimeters signalingTimes 1000)

fun min(a: PreciseDuration, b: PreciseDuration): PreciseDuration = if (a < b) a else b

fun max(a: PreciseDuration, b: PreciseDuration): PreciseDuration = if (a < b) b else a

@JvmInline
value class PreciseSpeed(val micrometersPerSecond: Long) : Comparable<PreciseSpeed> {
    val metersPerSecond: Double
        get() = micrometersPerSecond.toDouble() / 1e6

    override fun toString(): String {
        val um = (micrometersPerSecond % 1_000_000).absoluteValue.toString().padStart(6, '0')
        val m = (micrometersPerSecond / 1_000_000).absoluteValue
        val sign = if (micrometersPerSecond < 0) "-" else ""
        return "$sign$m.${um}m/s"
    }

    override fun compareTo(other: PreciseSpeed): Int =
        micrometersPerSecond.compareTo(other.micrometersPerSecond)

    operator fun plus(other: PreciseSpeed): PreciseSpeed =
        PreciseSpeed(
            micrometersPerSecond = micrometersPerSecond signalingPlus other.micrometersPerSecond
        )

    operator fun minus(other: PreciseSpeed): PreciseSpeed =
        PreciseSpeed(
            micrometersPerSecond = micrometersPerSecond signalingMinus other.micrometersPerSecond
        )

    operator fun times(duration: PreciseDuration): PreciseDistance =
        PreciseDistance(
            micrometers = (micrometersPerSecond signalingTimes duration.microseconds) / 1_000_000
        )

    operator fun times(factor: Double): PreciseSpeed =
        PreciseSpeed(micrometersPerSecond = (micrometersPerSecond * factor).toLong())

    operator fun times(distance: PreciseDistance): PreciseDiSp =
        PreciseDiSp(
            micrometers2PerSecond = micrometersPerSecond signalingTimes distance.micrometers
        )

    operator fun div(duration: PreciseDuration): PreciseAcceleration =
        PreciseAcceleration(
            micrometersPerSecond2 =
                (micrometersPerSecond signalingTimes 1_000_000) / duration.microseconds
        )

    /**
     * Division floored towards -inf. A -0.5um/s-2 deceleration would normally round up to 0um/s-2
     * which would create a less constrained step. This function instead rounds it to -1um/s-2.
     */
    fun floorDiv(duration: PreciseDuration): PreciseAcceleration =
        PreciseAcceleration(
            micrometersPerSecond2 =
                (micrometersPerSecond signalingTimes 1_000_000).floorDiv(duration.microseconds)
        )
}

val Double.metersPerSecond: PreciseSpeed
    get() = PreciseSpeed(micrometersPerSecond = (this * 1e6).toLong())

/** kilometers per hour */
val Double.kph: PreciseSpeed
    get() = PreciseSpeed(micrometersPerSecond = (this / 3.6e-6).toLong())
val Int.micrometersPerSecond: PreciseSpeed
    get() = PreciseSpeed(micrometersPerSecond = this.toLong())
val Long.micrometersPerSecond: PreciseSpeed
    get() = PreciseSpeed(micrometersPerSecond = this)

fun min(a: PreciseSpeed, b: PreciseSpeed): PreciseSpeed = if (a < b) a else b

@JvmInline
value class PreciseAcceleration(val micrometersPerSecond2: Long) : Comparable<PreciseAcceleration> {
    val metersPerSecond2: Double
        get() = micrometersPerSecond2.toDouble() / 1e6

    override fun toString(): String {
        val um = (micrometersPerSecond2 % 1_000_000).absoluteValue.toString().padStart(6, '0')
        val m = (micrometersPerSecond2 / 1_000_000).absoluteValue
        val sign = if (micrometersPerSecond2 < 0) "-" else ""
        return "$sign$m.${um}m/s²"
    }

    override fun compareTo(other: PreciseAcceleration): Int =
        micrometersPerSecond2.compareTo(other.micrometersPerSecond2)

    operator fun times(duration: PreciseDuration): PreciseSpeed =
        PreciseSpeed(
            micrometersPerSecond = micrometersPerSecond2 * duration.microseconds / 1_000_000
        )
}

val Double.metersPerSecond2: PreciseAcceleration
    get() = PreciseAcceleration(micrometersPerSecond2 = (this * 1e6).toLong())
val Int.micrometersPerSecond2: PreciseAcceleration
    get() = PreciseAcceleration(micrometersPerSecond2 = this.toLong())

fun min(a: PreciseAcceleration, b: PreciseAcceleration): PreciseAcceleration = if (a < b) a else b

/** Value representing the product of a duration and a distance. expressed in `µm*µs` */
@JvmInline
value class PreciseDiDu(val micrometersMicrosecond: Long) : Comparable<PreciseDiDu> {
    override fun compareTo(other: PreciseDiDu): Int =
        micrometersMicrosecond.compareTo(other.micrometersMicrosecond)

    operator fun div(distance: PreciseDistance): PreciseDuration =
        PreciseDuration(microseconds = micrometersMicrosecond / distance.micrometers)
}

/** Value representing the square of a duration. expressed in `µs²` */
@JvmInline
value class PreciseDuration2(val microseconds2: Long) : Comparable<PreciseDuration2> {
    override fun compareTo(other: PreciseDuration2): Int =
        microseconds2.compareTo(other.microseconds2)

    operator fun div(duration: PreciseDuration): PreciseDuration =
        PreciseDuration(microseconds = microseconds2 / duration.microseconds)
}

/** Value representing a speed times a distance. expressed in `µm²/s` */
@JvmInline
value class PreciseDiSp(val micrometers2PerSecond: Long) : Comparable<PreciseDiSp> {
    override fun compareTo(other: PreciseDiSp): Int =
        micrometers2PerSecond.compareTo(other.micrometers2PerSecond)

    operator fun div(duration: PreciseDistance): PreciseSpeed =
        PreciseSpeed(micrometersPerSecond = micrometers2PerSecond / duration.micrometers)
}
