package fr.sncf.osrd.utils;

public class FloatCompare {
    private static final double EPSILON = 1e-5;

    /**
     * Tests equality between doubles, based on a predefined epsilon.
     * @param a a
     * @param b b
     * @return the result of the equality test
     */
    public static boolean eq(double a, double b) {
        if (a > b)
            return a - b < EPSILON;
        return b - a < EPSILON;
    }
}
