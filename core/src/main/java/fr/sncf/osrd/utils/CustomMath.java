package fr.sncf.osrd.utils;

public class CustomMath {
    /** Clamp a value between a given range */
    public static double clamp(double val, double min, double max) {
        assert min <= max;
        if (val < min)
            return min;
        return Math.min(val, max);
    }
}
