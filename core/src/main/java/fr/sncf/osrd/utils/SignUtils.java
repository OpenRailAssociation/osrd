package fr.sncf.osrd.utils;

public abstract class SignUtils {
    /** Flips the sign of value if flip is negative */
    public static double conditionalNegate(double value, double flip) {
        final var rawValue = Double.doubleToRawLongBits(value);
        final var rawFlip = Double.doubleToRawLongBits(flip);
        // the last bit of a float encodes its sign. take the sign bit from flip and xor it with value
        return Double.longBitsToDouble(rawValue ^ (rawFlip & 0x8000000000000000L));
    }
}
