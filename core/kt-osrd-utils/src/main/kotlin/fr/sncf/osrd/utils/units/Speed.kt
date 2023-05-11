package fr.sncf.osrd.utils.units

private const val multiplier = 1000.0

@JvmInline
value class Speed(private val millimetersPerSeconds: ULong) {
    val metersPerSeconds get() = millimetersPerSeconds.toDouble() / multiplier
}

val Double.metersPerSeconds: Distance get() = Distance((this * multiplier).toLong())
