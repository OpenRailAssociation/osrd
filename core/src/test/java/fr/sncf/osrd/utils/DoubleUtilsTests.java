package fr.sncf.osrd.utils;

import static fr.sncf.osrd.utils.DoubleUtils.clamp;
import static fr.sncf.osrd.utils.DoubleUtils.conditionalNegate;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

public class DoubleUtilsTests {

    @Test
    public void testClamp() {
        var a = 5;
        var clamped = clamp(a, 0, 10);
        assertEquals(5, clamped);
        var bottomClamped = clamp(a, 7, 10);
        assertEquals(7, bottomClamped);
        var topClamped = clamp(a, 0, 3);
        assertEquals(3, topClamped);
    }

    @Test
    public void testConditionNegate() {
        var a = 5;
        long flip = -1;
        var flipped = conditionalNegate(a, flip);
        assertEquals(-a, flipped);
    }
}
