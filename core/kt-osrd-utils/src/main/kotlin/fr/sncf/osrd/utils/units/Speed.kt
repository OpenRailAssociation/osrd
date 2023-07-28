package fr.sncf.osrd.utils.units

private const val multiplier = 1000.0

@JvmInline
value class Speed(val millimetersPerSecond: ULong) {
    val metersPerSecond get() = millimetersPerSecond.toDouble() / multiplier

    override fun toString(): String {
        val metersPerSecond = millimetersPerSecond / multiplier.toUInt()
        val decimal = metersPerSecond % multiplier.toUInt()
        if (decimal == 0UL)
            return String.format("%sm/s", metersPerSecond)
        else
            return String.format("%s.%sm/s", metersPerSecond, decimal)
    }

    companion object {
        @JvmStatic
        fun fromMetersPerSecond(metersPerSecond: Double): Speed {
            return Speed(millimetersPerSecond = (metersPerSecond * multiplier).toULong())
        }

        @JvmStatic
        @JvmName("toMetersPerSecond")
        fun toMetersPerSecond(speed: Speed): Double {
            return speed.metersPerSecond
        }
    }
}

val Double.metersPerSecond: Distance get() = Distance((this * multiplier).toLong())
