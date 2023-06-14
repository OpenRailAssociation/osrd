package fr.sncf.osrd.envelope_utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.google.common.collect.Range;
import com.google.common.collect.TreeRangeMap;
import org.junit.jupiter.api.Test;

public class RangeMapUtilsTest {
    @Test
    public void testMergeRanges() {
        var toMerge = TreeRangeMap.<Double, String>create();
        toMerge.put(Range.closedOpen(-7.0, 1.0), "a");
        toMerge.put(Range.closedOpen(1.0, 7.0), "a");
        toMerge.put(Range.closedOpen(7.0, 8.0), "b");
        toMerge.put(Range.closedOpen(8.0, 9.0), "a");
        toMerge.put(Range.closedOpen(9.1, 10.0), "a");
        toMerge.put(Range.closedOpen(10.0, 12.0), "a");

        var expectedMerge = TreeRangeMap.<Double, String>create();
        expectedMerge.put(Range.closedOpen(-7.0, 7.0), "a");
        expectedMerge.put(Range.closedOpen(7.0, 8.0), "b");
        expectedMerge.put(Range.closedOpen(8.0, 9.0), "a");
        expectedMerge.put(Range.closedOpen(9.1, 12.0), "a");

        var merged = RangeMapUtils.mergeRanges(toMerge);

        assertEquals(expectedMerge, merged);
    }

    @Test
    public void testMergeNoRanges() {
        var toMerge = TreeRangeMap.<Double, String>create();
        var expectedMerge = TreeRangeMap.<Double, String>create();
        var merged = RangeMapUtils.mergeRanges(toMerge);
        assertEquals(expectedMerge, merged);
    }

    @Test
    public void testFullyCoversFail() {
        var rangeMap = TreeRangeMap.<Double, String>create();
        rangeMap.put(Range.closedOpen(0.0, 1.0), "a");
        rangeMap.put(Range.closedOpen(1.0, 2.0), "b");
        rangeMap.put(Range.closedOpen(2.1, 3.0), "c");

        assertFalse(RangeMapUtils.fullyCovers(rangeMap, 3.0));
    }

    @Test
    public void testFullyCoversEmpty() {
        var rangeMap = TreeRangeMap.<Double, String>create();

        assertFalse(RangeMapUtils.fullyCovers(rangeMap, 3.0));
    }
}
