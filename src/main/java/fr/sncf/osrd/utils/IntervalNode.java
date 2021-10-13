package fr.sncf.osrd.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Objects;

public abstract class IntervalNode {
    public final double begin;
    public final double end;

    /** The maximum value of all range ends for this subtree */
    transient double maxEnd;
    transient int height;

    transient IntervalNode leftChild;
    transient IntervalNode rightChild;

    /** A reference to the tree this node belongs to, for safety checks */
    transient IntervalTree<?> tree;

    /**
     * Creates a new interval tree node
     * @param begin the start of the interval
     * @param end the end of the interval
     */
    public IntervalNode(double begin, double end) {
        this.begin = begin;
        this.end = end;
        this.maxEnd = end;
        this.height = 1;
        this.leftChild = null;
        this.rightChild = null;
        this.tree = null;
    }

    /**
     * Confirm whether the node's interval overlaps with a given interval
     * @param otherBegin the lower bound of a given interval
     * @param otherEnd the lower bound of a given interval
     * @return true if the node's interval and the given interval overlap, false otherwise
     */
    boolean overlapsWith(double otherBegin, double otherEnd) {
        return begin <= otherEnd && end >= otherBegin;
    }

    @SuppressFBWarnings(
            value = "FE_FLOATING_POINT_EQUALITY",
            justification = "we don't believe tolerance is needed here"
    )
    public boolean equals(IntervalNode o) {
        return o.begin == begin
                && o.end == end;
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (!(obj instanceof IntervalNode))
            return false;

        return equals((IntervalNode) obj);
    }

    @Override
    public int hashCode() {
        return Objects.hash(begin, end);
    }
}