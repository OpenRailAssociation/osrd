package fr.sncf.osrd.utils;

public class DoubleUtils {
    /** Clamp a value between a given range */
    public static double clamp(double val, double min, double max) {
        assert min <= max;
        if (val < min)
            return min;
        return Math.min(val, max);
    }

    /** Flips the sign of value if flip is negative */
    public static double conditionalNegate(double value, double flip) {
        final var rawValue = Double.doubleToRawLongBits(value);
        final var rawFlip = Double.doubleToRawLongBits(flip);
        // the last bit of a float encodes its sign. take the sign bit from flip and xor it with value
        return Double.longBitsToDouble(rawValue ^ (rawFlip & 0x8000000000000000L));
    }

    /** Compare a and b along a given direction */
    public static double dirCompare(double direction, double a, double b) {
        return conditionalNegate(a - b, direction);
    }
}
