package fr.sncf.osrd.utils.units

private const val multiplier = 1000.0

@JvmInline
value class Speed(val millimetersPerSecond: ULong) : Comparable<Speed> {
    val metersPerSecond
        get() = millimetersPerSecond.toDouble() / multiplier

    override fun toString(): String {
        val metersPerSecond = millimetersPerSecond / multiplier.toUInt()
        val decimal = metersPerSecond % multiplier.toUInt()
        if (decimal == 0UL) return String.format("%sm/s", metersPerSecond)
        else return String.format("%s.%sm/s", metersPerSecond, decimal)
    }

    companion object {
        @JvmStatic
        fun fromMetersPerSecond(metersPerSecond: Double): Speed {
            return Speed(millimetersPerSecond = Math.round(metersPerSecond * multiplier).toULong())
        }

        @JvmStatic
        @JvmName("toMetersPerSecond")
        fun toMetersPerSecond(speed: Speed): Double {
            return speed.metersPerSecond
        }
    }

    override fun compareTo(other: Speed): Int {
        return millimetersPerSecond.compareTo(other.millimetersPerSecond)
    }
}

val Double.metersPerSecond: Speed
    get() = Speed.fromMetersPerSecond(this)

val Int.kilometersPerHour: Speed
    get() = Speed.fromMetersPerSecond(this * 1000.0 / 3600.0)
