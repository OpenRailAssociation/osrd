package fr.sncf.osrd.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public enum CompareSign {
    LOWER(false, -1),
    LOWER_OR_EQUAL(true, -1),
    HIGHER(false, 1),
    HIGHER_OR_EQUAL(true, 1),
    ;

    public final boolean allowEqual;
    public final double expectedSign;

    CompareSign(boolean allowEqual, double expectedSign) {
        this.allowEqual = allowEqual;
        this.expectedSign = expectedSign;
    }

    /** Compares value with reference */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public static boolean compare(double value, double reference, CompareSign operation) {
        var resSign = Math.signum(value - reference);
        if (resSign == 0.0)
            return operation.allowEqual;
        return resSign == operation.expectedSign;
    }
}
