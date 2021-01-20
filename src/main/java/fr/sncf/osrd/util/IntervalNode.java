package fr.sncf.osrd.util;

public class IntervalNode<T> {
    public double begin;
    public double end;
    public double maxEnd;
    public int height;
    public IntervalNode<T> leftChild;
    public IntervalNode<T> rightChild;
    public T value;

    /**
     * Create an IntervalNode
     * @param begin the lower bound of the interval
     * @param end the upper bound of the interval
     * @param value the value stored in the node
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
}