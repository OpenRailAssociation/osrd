package fr.sncf.osrd.utils

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.utils.units.Distance

fun <T : Any> DistanceRangeMap<T>.put(entry: Range<Double>, value: T) =
    put(
        Distance.fromMeters(entry.lowerEndpoint()),
        Distance.fromMeters(entry.upperEndpoint()),
        value,
    )

// TODO: Get rid of this function, by propagating DistanceRangeMap to the whole codebase
/**
 * Converts a DistanceRangeMap<T> into a legacy RangeMap<Double, T>. Distances are converted to
 * floats (m).
 */
fun <T : Any> DistanceRangeMap<T>.toRangeMap(): RangeMap<Double, T> {
    val res = ImmutableRangeMap.builder<Double, T>()
    forEach { lower, upper, value -> res.put(Range.closedOpen(lower.meters, upper.meters), value) }
    return res.build()
}

fun <T : Any> DistanceRangeMapImpl.Companion.from(map: RangeMap<Distance, T>): DistanceRangeMap<T> {
    val res = distanceRangeMapOf<T>()
    for (entry in map.asMapOfRanges().entries) res.put(
        entry.key.lowerEndpoint(),
        entry.key.upperEndpoint(),
        entry.value,
    )
    return res
}

fun <T : Any> DistanceRangeMapImpl.Companion.toRangeMap(
    distanceRangeMap: DistanceRangeMap<T>
): RangeMap<Distance, T> {
    val rangeMap = TreeRangeMap.create<Distance, T>()
    distanceRangeMap.forEach { lower, upper, value ->
        rangeMap.put(Range.closed(lower, upper), value)
    }
    return rangeMap
}

fun DistanceRangeSetImpl.Companion.from(set: RangeSet<Double>): DistanceRangeSet {
    val res = distanceRangeSetOf()
    for (entry in set.asRanges()) res.put(
        Distance.fromMeters(entry.lowerEndpoint()),
        Distance.fromMeters(entry.upperEndpoint()),
    )
    return res
}
