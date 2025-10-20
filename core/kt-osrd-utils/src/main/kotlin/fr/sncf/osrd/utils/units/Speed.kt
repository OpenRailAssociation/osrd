package fr.sncf.osrd.utils.units

private const val multiplier = 1000.0

/**
 * Describes a speed.
 *
 * This is an inlined value class (where the inner type is itself an inlined value class). The JVM
 * sees this as a simple Long. When interfacing with Java or other languages, this is typed as a
 * Long and the unit is millimeters.
 *
 * When this appears in a JSON payload, the unit is mm/s typed as a Long.
 */
@JvmInline
value class Speed(val millimetersPerSecond: ULong) : Comparable<Speed> {
    val metersPerSecond
        get() = millimetersPerSecond.toDouble() / multiplier

    override fun toString(): String {
        val metersPerSecond = millimetersPerSecond / multiplier.toUInt()
        val decimal = millimetersPerSecond % multiplier.toUInt()
        if (decimal == 0UL) return String.format("%sm/s", metersPerSecond)
        else return String.format("%s.%sm/s", metersPerSecond, decimal)
    }

    companion object {
        fun fromMetersPerSecond(metersPerSecond: Double): Speed {
            return Speed(millimetersPerSecond = Math.round(metersPerSecond * multiplier).toULong())
        }

        fun toMetersPerSecond(speed: Speed): Double {
            return speed.metersPerSecond
        }

        fun min(a: Speed, b: Speed) =
            Speed(
                millimetersPerSecond = a.millimetersPerSecond.coerceAtMost(b.millimetersPerSecond)
            )

        fun max(a: Speed, b: Speed) =
            Speed(
                millimetersPerSecond = a.millimetersPerSecond.coerceAtLeast(b.millimetersPerSecond)
            )
    }

    override fun compareTo(other: Speed): Int {
        return millimetersPerSecond.compareTo(other.millimetersPerSecond)
    }
}

val Double.metersPerSecond: Speed
    get() = Speed.fromMetersPerSecond(this)

val Int.kilometersPerHour: Speed
    get() = Speed.fromMetersPerSecond(this * 1000.0 / 3600.0)
