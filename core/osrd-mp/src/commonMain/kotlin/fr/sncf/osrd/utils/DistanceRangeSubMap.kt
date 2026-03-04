package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance

internal class DistanceRangeSubMap<T>(
    private val fullMap: DistanceRangeMap<T>,
    private val lower: Distance,
    private val upper: Distance,
    private val shift: Distance,
) : DistanceRangeMap<T> {
    override fun lowerBound(): Distance = lower

    override fun upperBound(): Distance = upper

    override fun get(offset: Distance): T? =
        if (offset !in lower..<upper) {
            null
        } else {
            fullMap.get(offset - shift)
        }

    override fun toMutableDistanceRangeMap(): MutableDistanceRangeMap<T> = distanceRangeMapOf(this)

    override fun subMap(lower: Distance, upper: Distance, shift: Distance): DistanceRangeMap<T> =
        DistanceRangeSubMap(
            fullMap = fullMap,
            lower = Distance.max(lower, this.lower) + shift,
            upper = Distance.min(upper, this.upper) + shift,
            shift = this.shift + shift,
        )

    override fun isEmpty(): Boolean = lower >= upper

    override fun iterator(): Iterator<DistanceRangeMap.RangeMapEntry<T>> =
        fullMap
            .asSequence()
            .dropWhile { it.upper <= this.lower - shift }
            .takeWhile { it.lower < this.upper - shift }
            .map {
                if (it.lower < this.lower - shift || it.upper > this.upper - shift) {
                    it.copy(
                        lower = Distance.max(it.lower + shift, this.lower),
                        upper = Distance.min(it.upper + shift, this.upper),
                    )
                } else {
                    it.copy(lower = it.lower + shift, upper = it.upper + shift)
                }
            }
            .iterator()

    override fun equals(other: Any?): Boolean =
        other is DistanceRangeMap<*> &&
            this.asSequence().zip(other.asSequence()).all { (t, o) -> t == o }

    override fun hashCode(): Int = fold(1) { hashCode, entry -> hashCode * 31 + entry.hashCode() }

    override fun toString(): String =
        joinToString(prefix = "{", postfix = "}") { "[${it.lower},${it.upper}]=${it.value}" }
}
