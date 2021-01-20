package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.util.IntervalNode;
import fr.sncf.osrd.util.IntervalTree;

import java.util.ArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;



public class IntervalTreeTest {

    private IntervalTree<Integer> tree;
    private ArrayList<IntervalNode<Integer>> results;
    private ArrayList<IntervalNode<Integer>> expected;

    /**
     * Fill tree with intervals and initialize results and expected arrays
     */
    @BeforeEach
    public void setUp() {
        tree = new IntervalTree<>();
        tree.insert(new IntervalNode<>(16, 21, 42));
        tree.insert(new IntervalNode<>(8, 9, 42));
        tree.insert(new IntervalNode<>(5, 8, 42));
        tree.insert(new IntervalNode<>(0, 3, 42));
        tree.insert(new IntervalNode<>(6, 10, 42));
        tree.insert(new IntervalNode<>(15, 23, 42));
        tree.insert(new IntervalNode<>(25, 30, 42));
        tree.insert(new IntervalNode<>(17, 19, 42));
        tree.insert(new IntervalNode<>(19, 20, 42));
        tree.insert(new IntervalNode<>(26, 26, 42));

        results = new ArrayList<>();
        expected = new ArrayList<>();
    }

    @Test
    public void singleOverlap() {
        tree.findOverlappingIntervals(results::add, 1, 2);
        expected.add(new IntervalNode<>(0, 3, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void easyOverlap1() {
        tree.findOverlappingIntervals(results::add, 6, 7);
        expected.add(new IntervalNode<>(5, 8, 42));
        expected.add(new IntervalNode<>(6, 10, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void easyOverlap2() {
        tree.findOverlappingIntervals(results::add, 26, 26);
        expected.add(new IntervalNode<>(26, 26, 42));
        expected.add(new IntervalNode<>(25, 30, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void manyOverlap() {
        tree.findOverlappingIntervals(results::add, 19, 20);
        expected.add(new IntervalNode<>(19, 20, 42));
        expected.add(new IntervalNode<>(17, 19, 42));
        expected.add(new IntervalNode<>(16, 21, 42));
        expected.add(new IntervalNode<>(15, 23, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void noOverlapMiddle() {
        tree.findOverlappingIntervals(results::add, 11, 12);

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void noOverlapExtremeLeft() {
        tree.findOverlappingIntervals(results::add, -2, -1);

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void noOverlapExtremeRight() {
        tree.findOverlappingIntervals(results::add, 40, 41);

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void leftOverlap() {
        tree.findOverlappingIntervals(results::add, 3, 4);
        expected.add(new IntervalNode<>(0, 3, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void rightOverlap() {
        tree.findOverlappingIntervals(results::add, -3, 1);
        expected.add(new IntervalNode<>(0, 3, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }
}