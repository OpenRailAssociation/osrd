package fr.sncf.osrd.utils;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;

public class DeepEqualsUtilsTests {
    private static class PlaceholderComparable implements DeepComparable<PlaceholderComparable> {
        private int value;

        public PlaceholderComparable(int value) {
            this.value = value;
        }

        @Override
        public boolean deepEquals(PlaceholderComparable other) {
            return value == other.value;
        }
    }

    private static PlaceholderComparable makeVal(int x) {
        return new PlaceholderComparable(x);
    }

    @Test
    public void testEqualLists() {
        var l1 = List.of(makeVal(1), makeVal(2), makeVal(3));
        var l2 = new ArrayList<>(List.of(makeVal(1), makeVal(2), makeVal(3)));
        var l3 = new ArrayList<>(List.of(makeVal(1), makeVal(2), makeVal(3), makeVal(4)));
        var l4 = new ArrayList<>(List.of(makeVal(1), makeVal(-2), makeVal(3)));
        assert DeepEqualsUtils.deepEquals(l1, l2);
        assert !DeepEqualsUtils.deepEquals(l1, l3);
        assert !DeepEqualsUtils.deepEquals(l2, l4);
    }

    @Test
    public void testEqualListOfArray() {
        var l1 = List.of(new PlaceholderComparable[]{
                makeVal(0), makeVal(1)
        });
        var l2 = List.of(new PlaceholderComparable[]{
                makeVal(0), makeVal(1)
        });
        var l3 = List.of(new PlaceholderComparable[]{
                makeVal(0), makeVal(1),
                makeVal(0), makeVal(1)
        });
        var l4 = List.of(new PlaceholderComparable[]{
                makeVal(0), makeVal(-1),
        });
        assert DeepEqualsUtils.deepEquals(l1, l2);
        assert !DeepEqualsUtils.deepEquals(l1, l3);
        assert !DeepEqualsUtils.deepEquals(l2, l4);
    }
}
