package fr.sncf.osrd.utils;

public interface DeepComparable<T> {
    boolean deepEquals(T other);
}
