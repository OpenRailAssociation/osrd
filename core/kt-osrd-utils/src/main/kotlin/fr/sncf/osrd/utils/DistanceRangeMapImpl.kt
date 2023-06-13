package fr.sncf.osrd.utils

import com.google.common.collect.RangeMap
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.MutableDistanceArrayList
import kotlin.math.min

data class DistanceRangeMapImpl<T>(
    private val bounds: MutableDistanceArrayList,
    private val values: MutableList<T?>,
) : DistanceRangeMap<T> {

    constructor() : this(MutableDistanceArrayList(), ArrayList())

    /** Sets the value between the lower and upper distances */
    override fun put(lower: Distance, upper: Distance, value: T) {
        putOptional(lower, upper, value)
    }

    /** Iterates over the entries in the map */
    override fun iterator(): Iterator<DistanceRangeMap.RangeMapEntry<T>> {
        return asList().iterator()
    }

    /** Returns a list of the entries in the map */
    override fun asList(): List<DistanceRangeMap.RangeMapEntry<T>> {
        validate()
        val res = ArrayList<DistanceRangeMap.RangeMapEntry<T>>()
        for (i in 0 until values.size) {
            if (values[i] != null)
                res.add(
                    DistanceRangeMap.RangeMapEntry(
                        bounds[i],
                        bounds[i + 1],
                        values[i]!!
                    )
                )
        }
        return res
    }

    override fun lowerBound(): Distance {
        return bounds[0]
    }

    override fun upperBound(): Distance {
        return bounds[bounds.size - 1]
    }

    override fun truncate(beginOffset: Distance, endOffset: Distance) {
        putOptional(lowerBound(), beginOffset, null)
        putOptional(endOffset, upperBound(), null)
        if (values.isNotEmpty() && values[0] == null) {
            bounds.remove(0)
            values.removeAt(0)
        }
        if (values.isNotEmpty() && values[values.size - 1] == null) {
            bounds.remove(bounds.size - 1)
            values.removeAt(values.size - 1)
        }
    }

    override fun shiftPositions(offset: Distance) {
        for (i in 0 until bounds.size)
            bounds[i] = bounds[i] + offset
    }

    override fun get(offset: Distance): T? {
        // TODO: use a binary search
        for (entry in this.reversed()) {
            if (entry.lower <= offset && offset <= entry.upper)
                return entry.value
        }
        return null
    }

    /** Merges adjacent values, removes 0-length ranges */
    private fun mergeAdjacent() {
        fun remove(i: Int) {
            values.removeAt(i)
            bounds.remove(i + 1)
        }
        // Merge 0 length ranges
        var i = 0
        while (i < bounds.size - 1) {
            if (bounds[i] == bounds[i + 1])
                remove(i)
            else
                i++
        }
        // Merge identical ranges
        i = 0
        while (i < values.size - 1) {
            if (values[i] == values[i + 1])
                remove(i)
            else
                i++
        }
        if (values.isEmpty() && bounds.size > 0)
            bounds.remove(0)
    }

    /** Put a new bound and a matching value at the given offset,
     * before the existing transition at that index if there is one */
    private fun putTransitionBefore(offset: Distance, newValue: T?) {
        var i = 0
        while (i < bounds.size && bounds[i] < offset)
            i++
        bounds.insert(i, offset)
        values.add(min(i, values.size), newValue)
    }

    /** Put a new bound and a matching value at the given offset,
     * after the existing transition at that index if there is one */
    private fun putTransitionAfter(offset: Distance, newValue: T?) {
        var i = 0
        while (i < bounds.size && bounds[i] <= offset)
            i++
        bounds.insert(i, offset)
        values.add(min(i, values.size), newValue)
    }

    /** Sets the value between the lower and upper distances.
     * This private method can put null values, used to delete ranges */
    private fun putOptional(lower: Distance, upper: Distance, value: T?) {
        if (bounds.size == 0) {
            bounds.add(lower)
            bounds.add(upper)
            values.add(value)
        } else {
            val previousNextValue = get(upper)
            if (upperBound() <= lower) {
                putTransitionBefore(lower, null)
                putTransitionBefore(upper, value)
            } else if (lowerBound() >= upper) {
                putTransitionBefore(lower, value)
                putTransitionBefore(upper, null)
            } else {
                putTransitionAfter(lower, value)
                putTransitionBefore(upper, previousNextValue)
            }
            var i = 0
            while (i < bounds.size) {
                if (lower < bounds[i] && bounds[i] < upper) {
                    bounds.remove(i)
                    values.removeAt(i)
                } else
                    i++
            }
        }
        mergeAdjacent()
        validate()
    }

    /** Asserts that the internal state is consistent */
    private fun validate() {
        assert(bounds.size == values.size + 1 || (bounds.size == 0 && values.isEmpty()))
    }

    companion object {
        fun <T>from(map: RangeMap<Double, T>): DistanceRangeMap<T> {
            val res = distanceRangeMapOf<T>()
            for (entry in map.asMapOfRanges())
                res.put(
                    Distance.fromMeters(entry.key.lowerEndpoint()),
                    Distance.fromMeters(entry.key.upperEndpoint()),
                    entry.value
                )
            return res
        }
    }
}