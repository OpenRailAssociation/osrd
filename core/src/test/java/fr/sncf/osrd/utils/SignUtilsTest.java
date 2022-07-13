package fr.sncf.osrd.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

public class SignUtilsTest {
    public void checkCondNegate(double value) {
        assertEquals(value, DoubleUtils.conditionalNegate(value, 1));
        assertEquals(-value, DoubleUtils.conditionalNegate(value, -1));
    }

    @Test
    public void flipRegular() {
        checkCondNegate(0);
        checkCondNegate(-0);
        checkCondNegate(2);
        checkCondNegate(-2);
        checkCondNegate(1);
        checkCondNegate(-1);
        checkCondNegate(10000);
        checkCondNegate(-10000);
        checkCondNegate(Double.MAX_VALUE);
        checkCondNegate(Double.MIN_VALUE);
        checkCondNegate(Double.POSITIVE_INFINITY);
        checkCondNegate(Double.NEGATIVE_INFINITY);
    }
}
