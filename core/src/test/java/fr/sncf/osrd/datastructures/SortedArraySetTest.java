package fr.sncf.osrd.datastructures;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import fr.sncf.osrd.utils.SortedArraySet;
import org.junit.jupiter.api.Test;

public class SortedArraySetTest {
    @Test
    public void equalsTest() {
        var setA = new SortedArraySet<Integer>();
        setA.add(3);
        setA.add(2);
        setA.add(1);
        var setB = new SortedArraySet<Integer>();
        setB.add(2);
        setB.add(3);
        setB.add(1);

        assertEquals(setA, setB);
    }

    @Test
    public void notEqualsTest() {
        var setA = new SortedArraySet<Integer>();
        setA.add(4);
        setA.add(2);
        setA.add(1);
        var setB = new SortedArraySet<Integer>();
        setB.add(2);
        setB.add(3);
        setB.add(1);

        assertNotEquals(setA, setB);
    }

    @Test
    public void simpleIntersectionTest() {
        var setA = new SortedArraySet<Integer>();
        setA.add(3);
        setA.add(2);
        setA.add(1);
        setA.add(4);
        var setB = new SortedArraySet<Integer>();
        setB.add(2);
        setB.add(3);
        setB.add(1);
        setB.add(5);

        var expected = new SortedArraySet<Integer>();
        expected.add(2);
        expected.add(3);
        expected.add(1);

        assertEquals(expected, setA.intersect(setB));
    }
}
