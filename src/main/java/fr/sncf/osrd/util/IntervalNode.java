package fr.sncf.osrd.util;

public class IntervalNode<T> {
    public double begin;
    public double end;
    public double maxEnd;
    public int height;
    public IntervalNode<T> leftChild;
    public IntervalNode<T> rightChild;
    public T value;

    public IntervalNode(double begin, double end, T value) {
        this.begin = begin;
        this.end = end;
        this.maxEnd = end;
        this.height = 1;
        this.leftChild = null;
        this.rightChild = null;
        this.value = value;
    }

    boolean overlapsWith(double otherBegin, double otherEnd) {
        return begin <= otherEnd && end >= otherBegin;
    }
}