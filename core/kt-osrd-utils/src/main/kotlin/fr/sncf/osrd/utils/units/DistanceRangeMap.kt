package fr.sncf.osrd.utils.units

import com.google.common.collect.RangeMap

data class DistanceRangeMap<T>(
    private val bounds: MutableDistanceArrayList,
    private val values: MutableList<T?>,
) : Iterable<DistanceRangeMap.RangeMapEntry<T>> {

    /** When iterating over the values of the map, this represents one range of constant value */
    data class RangeMapEntry<T>(
        val lower: Distance,
        val upper: Distance,
        val value: T,
    )

    constructor() : this(MutableDistanceArrayList(), ArrayList())

    /** Sets the value between the lower and upper distances */
    fun put(lower: Distance, upper: Distance, value: T) {
        var startIndex = 0
        while (startIndex < bounds.size && bounds[startIndex] < lower)
            startIndex++
        bounds.insert(startIndex, lower)

        // Add a new entry with the previous value, to "split" the current range
        if (startIndex > 0 && startIndex <= values.size)
            values.add(startIndex, values[startIndex - 1])
        else if (startIndex > values.size) {
            // The ranges don't overlap: we add a null value
            values.add(startIndex - 1, null)
        }
        values.add(startIndex, value)
        val endIndex = startIndex + 1
        while (endIndex < bounds.size && bounds[endIndex] < upper) {
            bounds.remove(endIndex)
            values.removeAt(endIndex)
        }
        bounds.insert(endIndex, upper)
        mergeAdjacent()
    }

    /** Iterates over the entries in the map */
    override fun iterator(): Iterator<RangeMapEntry<T>> {
        return asList().iterator()
    }

    /** Returns a list of the entries in the map */
    fun asList(): List<RangeMapEntry<T>> {
        assert(bounds.size == values.size + 1 || (bounds.size == 0 && values.isEmpty()))
        val res = ArrayList<RangeMapEntry<T>>()
        for (i in 0 until values.size) {
            if (values[i] != null)
                res.add(RangeMapEntry(
                    bounds[i],
                    bounds[i + 1],
                    values[i]!!
                ))
        }
        return res
    }

    /** Merges adjacent values, removes 0-length ranges */
    private fun mergeAdjacent() {
        fun remove(i: Int) {
            values.removeAt(i)
            bounds.remove(i + 1)
        }
        // Merge identical ranges
        var i = 0
        while (i < values.size - 1) {
            if (values[i] == values[i + 1])
                remove(i)
            else
                i++
        }
        // Merge 0 length ranges
        i = 0
        while (i < bounds.size - 1) {
            if (bounds[i] == bounds[i + 1])
                remove(i)
            else
                i++
        }
        if (values.isEmpty() && bounds.size > 0)
            bounds.remove(0)
    }

    companion object {
        fun <T>from(map: RangeMap<Double, T>): DistanceRangeMap<T> {
            val res = DistanceRangeMap<T>()
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