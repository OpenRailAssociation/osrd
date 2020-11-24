package fr.sncf.osrd.util;


public class PointValue<E> {
    public final double position;
    public final E value;

    public PointValue(double position, E value) {
        this.position = position;
        this.value = value;
    }
}