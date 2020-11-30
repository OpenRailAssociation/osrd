package fr.sncf.osrd.util;

public class FloatCompare {
    private final static double EPSILON = 1e-5;

    public static boolean eq(float a, float b) {
        if (a > b)
            return a - b < EPSILON;
        return b - a < EPSILON;
    }

    public static boolean eq(double a, double b) {
        if (a > b)
            return a - b < EPSILON;
        return b - a < EPSILON;
    }
}
