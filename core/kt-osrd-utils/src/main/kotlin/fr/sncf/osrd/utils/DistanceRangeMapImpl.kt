package fr.sncf.osrd.utils

import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.MutableDistanceArrayList
import java.util.PriorityQueue
import java.util.function.BiFunction
import kotlin.math.min

data class DistanceRangeMapImpl<T>(
    private val bounds: MutableDistanceArrayList,
    private val values: MutableList<T?>,
) : DistanceRangeMap<T> {

    constructor(
        entries: List<DistanceRangeMap.RangeMapEntry<T>> = emptyList()
    ) : this(MutableDistanceArrayList(), ArrayList()) {
        putMany(entries)
    }

    /** Sets the value between the lower and upper distances */
    override fun put(lower: Distance, upper: Distance, value: T) {
        putOptional(lower, upper, value)
    }

    /**
     * Sets many values more efficiently than many calls to `put`
     *
     * The idea here is to build the map from scratch, by iterating over sorted bounds and
     * maintaining entries priority.
     *
     * Another idea would be to use a temporary (so we can free the memory later) tree-like
     * structure (RangeMaps lib).
     */
    override fun putMany(entries: List<DistanceRangeMap.RangeMapEntry<T>>) {
        // Unfortunately, built-in groupBy doesn't consider the original order, here we want
        // consecutive values.
        fun <U, V> groupByConsecutiveFirst(pairs: List<Pair<U, V>>): List<Pair<U, List<V>>> {
            val result = mutableListOf<Pair<U, List<V>>>()
            if (pairs.isEmpty()) return result
            var nextKey = pairs[0].first
            var nextValues = mutableListOf(pairs[0].second)
            for ((key, value) in pairs.slice(1..<pairs.size)) {
                if (key == nextKey) {
                    nextValues.add(value)
                } else {
                    result.add(Pair(nextKey, nextValues))
                    nextKey = key
                    nextValues = mutableListOf(value)
                }
            }
            result.add(Pair(nextKey, nextValues))
            return result
        }

        fun <U, V> groupByConsecutiveSecond(pairs: List<Pair<U, V>>): List<Pair<V, List<U>>> {
            val swapped = mutableListOf<Pair<V, U>>()
            for ((first, second) in pairs) {
                swapped.add(Pair(second, first))
            }
            return groupByConsecutiveFirst(swapped)
        }

        // Order matters and existing entries should come first.
        // E.g. allEntries = [(lower=0, upper=5, value=1), (lower=5, upper=10, value=1)]
        val allEntries = asList() + entries

        // Start from scratch.
        values.clear()
        bounds.clear()

        // Build a sorted list of bounds, while keeping track of entries order.
        val boundEntries = mutableListOf<Pair<Distance, Int>>()
        for ((index, entry) in allEntries.withIndex()) {
            boundEntries.add(Pair(entry.lower, index))
            boundEntries.add(Pair(entry.upper, index))
        }
        // E.g. boundEntries = [(0, 0), (5, 0), (5, 1), (10, 1)]
        boundEntries.sortWith(
            Comparator<Pair<Distance, Int>> { a, b -> a.first.compareTo(b.first) }
                .thenBy { it.second }
        )
        // Group entries with the same bound.
        // E.g. entriesByBound = [(0, [0]), (5, [0, 1]), (10, [1])]
        val entriesByBound = groupByConsecutiveFirst(boundEntries)

        // Relevant entries for the interval we're building. Early entries have low priority.
        val entryQueue = PriorityQueue<Int> { i, j -> j - i }

        // Compute bounds and values.
        // E.g. nonEmptyBoundValues = [(0, 1), (5, 1), (10, null)]
        val nonEmptyBoundValues = mutableListOf<Pair<Distance, T?>>()
        for ((bound, indices) in entriesByBound) {
            for (index in indices) {
                // Update relevant entries. PriorityQueue only guarantees linear time for
                // contains and remove, an optimized heap could be helpful.
                if (entryQueue.contains(index)) entryQueue.remove(index) else entryQueue.add(index)
            }
            // Get the latest relevant entry.
            val bestIndex = entryQueue.peek()
            val value = if (bestIndex != null) allEntries[bestIndex].value else null
            nonEmptyBoundValues.add(Pair(bound, value))
        }

        // Merge adjacent ranges with the same value.
        // E.g. boundsByValue = [(1, [0, 5]), (null, [10])]
        val boundsByValue = groupByConsecutiveSecond(nonEmptyBoundValues)
        // E.g. bounds = [0, 10] values = [1, null]
        for ((value, boundsGroup) in boundsByValue) {
            bounds.add(boundsGroup.min())
            values.add(value)
        }
        // E.g. values = [1]
        if (values.isNotEmpty()) {
            values.removeLast()
        }
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
                res.add(DistanceRangeMap.RangeMapEntry(bounds[i], bounds[i + 1], values[i]!!))
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
        if (bounds.size != 0) {
            validate()
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
            if (values.isEmpty()) bounds.clear()
        }
    }

    override fun shiftPositions(offset: Distance) {
        for (i in 0 until bounds.size) bounds[i] = bounds[i] + offset
    }

    override fun get(offset: Distance): T? {
        // TODO: use a binary search
        for (entry in this.reversed()) {
            if (entry.lower <= offset && offset <= entry.upper) return entry.value
        }
        return null
    }

    override fun clone(): DistanceRangeMap<T> {
        return DistanceRangeMapImpl(bounds.clone(), values.toMutableList())
    }

    override fun subMap(lower: Distance, upper: Distance): DistanceRangeMap<T> {
        assert(lower < upper)
        val res = this.clone()
        res.truncate(lower, upper)
        return res
    }

    override fun isEmpty(): Boolean {
        return bounds.isEmpty()
    }

    override fun <U> updateMapIntersection(
        update: DistanceRangeMap<U>,
        updateFunction: BiFunction<T, U, T>,
    ) {
        for ((updateLower, updateUpper, updateValue) in update) {
            for ((subMapLower, subMapUpper, subMapValue) in this.subMap(updateLower, updateUpper)) {
                this.put(subMapLower, subMapUpper, updateFunction.apply(subMapValue, updateValue))
            }
        }
    }

    override fun updateMap(
        update: DistanceRangeMap<T>,
        updateFunction: (T, T) -> T,
        default: (T) -> T,
    ) {
        val resultEntries = mutableListOf<DistanceRangeMap.RangeMapEntry<T>>()

        // Iterate over each range in the update map
        for ((updateLower, updateUpper, updateValue) in update) {
            val subMap = this.subMap(updateLower, updateUpper)

            // Track segments that are part of the updated map but not intersecting with `this`
            if (subMap.isEmpty()) {
                resultEntries.add(
                    DistanceRangeMap.RangeMapEntry(updateLower, updateUpper, default(updateValue))
                )
            } else {
                // Handle intersections
                var lastEnd = updateLower

                for ((subMapLower, subMapUpper, subMapValue) in subMap) {
                    // Add non-overlapping segment from `update` before the intersection
                    if (lastEnd < subMapLower) {
                        resultEntries.add(
                            DistanceRangeMap.RangeMapEntry(
                                lastEnd,
                                subMapLower,
                                default(updateValue),
                            )
                        )
                    }

                    // Add the overlapping segment with combined value
                    val combinedValue = updateFunction(subMapValue, updateValue)
                    resultEntries.add(
                        DistanceRangeMap.RangeMapEntry(subMapLower, subMapUpper, combinedValue)
                    )

                    lastEnd = subMapUpper
                }

                // Add non-overlapping segment from `update` after the intersection
                if (lastEnd < updateUpper) {
                    val combinedValue = default(updateValue)
                    resultEntries.add(
                        DistanceRangeMap.RangeMapEntry(lastEnd, updateUpper, combinedValue)
                    )
                }
            }
        }

        // Add non-overlapping segments from `this`
        // It's the same thing except we never add the overlapping segments
        // Iterate over each range in the update map
        for ((thisLower, thisUpper, thisValue) in this) {
            val subMap = update.subMap(thisLower, thisUpper)

            // Track segments that are part of the updated map but not intersecting with `this`
            if (subMap.isEmpty()) {
                val combinedValue = default(thisValue)
                resultEntries.add(
                    DistanceRangeMap.RangeMapEntry(thisLower, thisUpper, combinedValue)
                )
            } else {
                // Handle intersections
                var lastEnd = thisLower

                for ((subMapLower, subMapUpper, subMapValue) in subMap) {
                    // Add non-overlapping segment from `this` before the intersection
                    if (lastEnd < subMapLower) {
                        val combinedValue = default(thisValue)
                        resultEntries.add(
                            DistanceRangeMap.RangeMapEntry(lastEnd, subMapLower, combinedValue)
                        )
                    }
                    lastEnd = subMapUpper
                }

                // Add non-overlapping segment from `this` after the intersection
                if (lastEnd < thisUpper) {
                    val combinedValue = default(thisValue)
                    resultEntries.add(
                        DistanceRangeMap.RangeMapEntry(lastEnd, thisUpper, combinedValue)
                    )
                }
            }
        }

        // Clear current map and insert the updated entries
        this.clear()
        this.putMany(resultEntries)
    }

    override fun clear() {
        bounds.clear()
        values.clear()
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
            if (bounds[i] == bounds[i + 1]) remove(i) else i++
        }
        // Merge identical ranges
        i = 0
        while (i < values.size - 1) {
            if (values[i] == values[i + 1]) remove(i) else i++
        }
        if (values.isEmpty() && bounds.size > 0) bounds.remove(0)
    }

    /**
     * Put a new bound and a matching value at the given offset, before the existing transition at
     * that index if there is one
     */
    private fun putTransitionBefore(offset: Distance, newValue: T?) {
        var i = 0
        while (i < bounds.size && bounds[i] < offset) i++
        bounds.insert(i, offset)
        values.add(min(i, values.size), newValue)
    }

    /**
     * Put a new bound and a matching value at the given offset, after the existing transition at
     * that index if there is one
     */
    private fun putTransitionAfter(offset: Distance, newValue: T?) {
        var i = 0
        while (i < bounds.size && bounds[i] <= offset) i++
        bounds.insert(i, offset)
        values.add(min(i, values.size), newValue)
    }

    /**
     * Sets the value between the lower and upper distances. This private method can put null
     * values, used to delete ranges
     */
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
                } else i++
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
        fun <T> from(map: RangeMap<Distance, T>): DistanceRangeMap<T> {
            val res = distanceRangeMapOf<T>()
            for (entry in map.entries) res.put(
                entry.key.lowerEndpoint(),
                entry.key.upperEndpoint(),
                entry.value,
            )
            return res
        }

        fun <T> toRangeMap(distanceRangeMap: DistanceRangeMap<T>): RangeMap<Distance, T> {
            val rangeMap = TreeRangeMap.create<Distance, T>()
            for (entry in distanceRangeMap.asList()) {
                rangeMap.put(Range.closed(entry.lower, entry.upper), entry.value!!)
            }
            return rangeMap
        }
    }
}
