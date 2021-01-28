package fr.sncf.osrd.util;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Objects;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class IntervalNode<T> {
    public double begin;
    public double end;
    public double maxEnd;
    public int height;
    public IntervalNode<T> leftChild;
    public IntervalNode<T> rightChild;
    public T value;

    /**
     * Creates a new interval tree node
     * @param begin the start of the interval
     * @param end the end of the interval
     * @param value the value associated with the range
     */
    public IntervalNode(double begin, double end, T value) {
        this.begin = begin;
        this.end = end;
        this.maxEnd = end;
        this.height = 1;
        this.leftChild = null;
        this.rightChild = null;
        this.value = value;
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

    @Override
    @SuppressFBWarnings(
            value = "FE_FLOATING_POINT_EQUALITY",
            justification = "we don't believe tolerance is needed here"
    )
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != getClass())
            return false;

        IntervalNode<?> node = (IntervalNode<?>) obj;
        return node.begin == begin
                && node.end == end
                && node.value == value;
    }

    @Override
    public int hashCode() {
        return Objects.hash(begin, end, value);
    }
}