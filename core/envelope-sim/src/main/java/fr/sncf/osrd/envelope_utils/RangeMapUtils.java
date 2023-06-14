package fr.sncf.osrd.envelope_utils;

import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import java.util.function.BiFunction;

public class RangeMapUtils {
    /**
     * Returns a range map where the adjacent ranges of same values have been merged
     */
    public static <T> RangeMap<Double, T> mergeRanges(RangeMap<Double, T> map) {
        TreeRangeMap<Double, T> result = TreeRangeMap.create();
        var entryIterator = map.asMapOfRanges().entrySet().iterator();
        if (!entryIterator.hasNext())
            return result;
        var currentEntry = entryIterator.next();
        var currentRange = currentEntry.getKey();
        var currentValue = currentEntry.getValue();
        while (entryIterator.hasNext()) {
            var nextEntry = entryIterator.next();
            var nextRange = nextEntry.getKey();
            var nextValue = nextEntry.getValue();
            if (currentValue.equals(nextValue) && currentRange.isConnected(nextRange)) {
                currentRange = Range.closedOpen(currentRange.lowerEndpoint(), nextRange.upperEndpoint());
            } else {
                result.put(currentRange, currentValue);
                currentRange = nextRange;
                currentValue = nextValue;
            }
        }
        result.put(currentRange, currentValue);
        return result;
    }

    /**
     * Return the first map updated with another, using a merge function to fuse the values of intersecting ranges
     */
    public static <T, U> TreeRangeMap<Double, T> updateRangeMap(RangeMap<Double, T> map, RangeMap<Double, U> update,
                                             BiFunction<T, U, T> mergeFunction) {
        TreeRangeMap<Double, T> result = TreeRangeMap.create();
        result.putAll(map);
        for (var updateEntry : update.asMapOfRanges().entrySet()) {
            for (var intersectedEntry : map.subRangeMap(updateEntry.getKey()).asMapOfRanges().entrySet()) {
                var intersectedRange = intersectedEntry.getKey();
                var intersectedValue = intersectedEntry.getValue();
                result.putCoalescing(intersectedRange, mergeFunction.apply(intersectedValue, updateEntry.getValue()));
            }
        }
        return result;
    }

    /**
     * Returns true if the ranges of the range map are contiguous (i.e. the upper endpoint of a range
     * is the lower endpoint of the next range) and cover the whole length
     */
    public static <T> boolean fullyCovers(RangeMap<Double, T> map, double length) {
        var entryIterator = map.asMapOfRanges().entrySet().iterator();
        if (!entryIterator.hasNext())
            return length == 0.0;
        var currentRange = entryIterator.next().getKey();
        while (entryIterator.hasNext()) {
            var nextRange = entryIterator.next().getKey();
            if (!currentRange.upperEndpoint().equals(nextRange.lowerEndpoint()))
                return false;
            currentRange = nextRange;
        }
        return currentRange.upperEndpoint().equals(length);
    }
}
