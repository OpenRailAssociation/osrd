package fr.sncf.osrd.utils;

import com.google.common.collect.*;
import java.util.Map;
import java.util.stream.Collectors;

public class RangeMapUtils {

    /** Compares two RangeMap. Assumes that open and closed intervals are equal */
    public static <K extends Comparable<K>, V> boolean equalsIgnoringTransitions(
            RangeMap<K, V> map1, RangeMap<K, V> map2
    ) {
        return asMapOfClosedRanges(map1).equals(asMapOfClosedRanges(map2));
    }

    /** Returns the RangeMap as a (range -> value) map, with all ranges being closed */
    private static <K extends Comparable<K>, V> Map<Range<K>, V> asMapOfClosedRanges(RangeMap<K, V> map) {
        return map.asMapOfRanges().entrySet().stream()
                .collect(Collectors.toMap(
                        e -> Range.closed(e.getKey().lowerEndpoint(), e.getKey().upperEndpoint()),
                        Map.Entry::getValue
                ));
    }
}
