package fr.sncf.osrd.envelope_utils;

import org.junit.jupiter.api.Test;

import static fr.sncf.osrd.envelope_utils.CurveUtils.generateCurve;
import static fr.sncf.osrd.envelope_utils.CurveUtils.interpolate;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class CurveUtilsTests {

    @Test
    public void testGenerate() {
        var xs = new double[]{0., 1., 2., 3.};
        var ys = new double[]{0., 1., 2., 3.};
        var curve = generateCurve(xs, ys);
        assertEquals(4, curve.length);
        assertEquals(new Point2d(0., 0.), curve[0]);
    }

    @Test
    public void interpolateTest() {
        var xs = new double[]{0., 1., 2., 3.};
        var ys = new double[]{0., 10., 20., 10.};
        var curve = generateCurve(xs, ys);
        assertEquals(5., interpolate(0.5, curve));
        assertEquals(0., interpolate(-1., curve));
        assertEquals(0., interpolate(0., curve));
        assertEquals(11., interpolate(1.1, curve));
        assertEquals(10., interpolate(4, curve));
    }
}
