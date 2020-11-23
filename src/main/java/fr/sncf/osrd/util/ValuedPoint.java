package fr.sncf.osrd.util;


public class ValuedPoint<E> {
    public final double position;
    public final E value;

    public ValuedPoint(double position, E value) {
        this.position = position;
        this.value = value;
    }
}