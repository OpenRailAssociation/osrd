package fr.sncf.osrd.utils.units

private const val multiplier = 1000.0

@JvmInline
value class Speed(private val millimetersPerSeconds: ULong) {
    val metersPerSeconds get() = millimetersPerSeconds.toDouble() / multiplier

    override fun toString(): String {
        val metersPerSeconds = millimetersPerSeconds / multiplier.toUInt()
        val decimal = metersPerSeconds % multiplier.toUInt()
        if (decimal == 0UL)
            return String.format("%sm/s", metersPerSeconds)
        else
            return String.format("%s.%sm/s", metersPerSeconds, decimal)
    }

    companion object {
        @JvmStatic
        fun fromMetersPerSeconds(metersPerSecond: Double): Speed {
            return Speed(millimetersPerSeconds = (metersPerSecond * multiplier).toULong())
        }
    }
}

val Double.metersPerSeconds: Distance get() = Distance((this * multiplier).toLong())
