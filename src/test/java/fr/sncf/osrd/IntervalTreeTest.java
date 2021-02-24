package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.utils.IntervalNode;
import fr.sncf.osrd.utils.IntervalTree;

import java.util.ArrayList;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;


public class IntervalTreeTest {

    static final class TestNode extends IntervalNode {
        public final int value;

        /**
         * Creates a new interval tree node
         *  @param begin the start of the interval
         * @param end the end of the interval
         * @param value the value associated to the node
         */
        public TestNode(double begin, double end, int value) {
            super(begin, end);
            this.value = value;
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null)
                return false;

            if (obj.getClass() != TestNode.class)
                return false;

            var o = (TestNode) obj;
            if (o.value != value)
                return false;

            return super.equals(o);
        }

        @Override
        public int hashCode() {
            return Objects.hash(super.hashCode(), value);
        }
    }

    private IntervalTree<TestNode> tree;
    private ArrayList<TestNode> results;
    private ArrayList<TestNode> expected;

    /**
     * Fill tree with intervals and initialize results and expected arrays
     */
    @BeforeEach
    public void setUp() {
        tree = new IntervalTree<>();
        tree.insert(new TestNode(16, 21, 42));
        tree.insert(new TestNode(8, 9, 42));
        tree.insert(new TestNode(5, 8, 42));
        tree.insert(new TestNode(0, 3, 42));
        tree.insert(new TestNode(6, 10, 42));
        tree.insert(new TestNode(15, 23, 42));
        tree.insert(new TestNode(25, 30, 42));
        tree.insert(new TestNode(17, 19, 42));
        tree.insert(new TestNode(19, 20, 42));
        tree.insert(new TestNode(26, 26, 42));

        results = new ArrayList<>();
        expected = new ArrayList<>();
    }

    @Test
    public void singleOverlap() {
        tree.findOverlappingIntervals(results::add, 1, 2);
        expected.add(new TestNode(0, 3, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void easyOverlap1() {
        tree.findOverlappingIntervals(results::add, 6, 7);
        expected.add(new TestNode(5, 8, 42));
        expected.add(new TestNode(6, 10, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void easyOverlap2() {
        tree.findOverlappingIntervals(results::add, 26, 26);
        expected.add(new TestNode(26, 26, 42));
        expected.add(new TestNode(25, 30, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void manyOverlap() {
        tree.findOverlappingIntervals(results::add, 19, 20);
        expected.add(new TestNode(19, 20, 42));
        expected.add(new TestNode(17, 19, 42));
        expected.add(new TestNode(16, 21, 42));
        expected.add(new TestNode(15, 23, 42));

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
        expected.add(new TestNode(0, 3, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }

    @Test
    public void rightOverlap() {
        tree.findOverlappingIntervals(results::add, -3, 1);
        expected.add(new TestNode(0, 3, 42));

        assertTrue(expected.size() == results.size()
                && expected.containsAll(results)
                && results.containsAll(expected));
    }
}