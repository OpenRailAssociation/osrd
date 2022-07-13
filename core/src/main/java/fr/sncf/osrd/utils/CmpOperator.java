package fr.sncf.osrd.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public enum CmpOperator {
    STRICTLY_LOWER(true, -1),
    LOWER(false, -1),
    STRICTLY_HIGHER(true, 1),
    HIGHER(false, 1),
    ;

    public final boolean isStrict;
    public final double expectedSign;

    CmpOperator(boolean isStrict, double expectedSign) {
        this.isStrict = isStrict;
        this.expectedSign = expectedSign;
    }

    /** Compares value with reference */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public static boolean compare(double valueA, CmpOperator operator, double valueB) {
        var resSign = Math.signum(valueA - valueB);
        if (resSign == 0.0)
            return !operator.isStrict;
        return resSign == operator.expectedSign;
    }
}
