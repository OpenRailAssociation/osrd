package fr.sncf.osrd.utils

import kotlin.jvm.JvmInline

@JvmInline
value class SignalingLong(val raw: Long) : Comparable<SignalingLong> {
    operator fun plus(other: SignalingLong): SignalingLong =
        SignalingLong(this.raw signalingPlus other.raw)

    operator fun minus(other: SignalingLong): SignalingLong =
        SignalingLong(this.raw signalingMinus other.raw)

    operator fun times(other: SignalingLong): SignalingLong =
        SignalingLong(this.raw signalingTimes other.raw)

    operator fun div(other: SignalingLong): SignalingLong =
        SignalingLong(this.raw signalingDiv other.raw)

    override fun compareTo(other: SignalingLong): Int = this.raw compareTo other.raw
}

// signaling* functions were taken from OpenJDK (GPL-2.0). See
// https://github.com/openjdk/jdk/blob/a506853a8267e5e4a5395ea0303e054d19acdbac/src/java.base/share/classes/java/lang/Math.java#L911

infix fun Long.signalingPlus(other: Long): Long {
    val result = this + other
    require((this xor result) and (other xor result) >= 0) { "'$this+$other' overflows Long" }
    return result
}

infix fun Long.signalingMinus(other: Long): Long {
    val result = this - other
    require((this xor result) and (this xor other) >= 0) { "'$this-$other' overflows Long" }
    return result
}

infix fun Long.signalingTimes(other: Long): Long {
    val result = this * other
    require((other == 0L || result / other == this) && (this != Long.MIN_VALUE || other != -1L)) {
        "'$this*$other' overflows Long"
    }
    return result
}

infix fun Long.signalingDiv(other: Long): Long {
    val result = this / other
    require((this and other and result) >= 0) { "'$this/$other' overflows Long" }
    return result
}
