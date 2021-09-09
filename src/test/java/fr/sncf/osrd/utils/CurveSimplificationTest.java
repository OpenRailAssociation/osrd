package fr.sncf.osrd.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.Arrays;

class CurveSimplificationTest {
    public static class Point {
        public final double x;
        public final double y;

        public Point(double x, double y) {
            this.x = x;
            this.y = y;
        }
    }

    private double customSin(double x, double freq) {
        return Math.sin(x / 3.1415 * freq);
    }

    private static class Dist implements CurveSimplification.RDPDist<Point> {

        @Override
        public double dist(Point point, Point start, Point end) {
            if (start.x == end.x)
                return Math.abs(point.y - start.y);
            var proj = start.y + (point.x - start.x) * (end.y - start.y) / (end.x - start.x);
            return Math.abs(point.y - proj);
        }
    }

    @Test
    public void simpleSimplification() {
        var points = new ArrayList<>(Arrays.asList(
                new Point(0, 0),
                new Point(5, 5),
                new Point(10, 10)
        ));
        var filteredPoints = CurveSimplification.rdp(points, 1, new Dist());
        assertEquals(2, filteredPoints.size());
    }

    @Test
    public void simpleNoSimplification() {
        var points = new ArrayList<>(Arrays.asList(
                new Point(0, 0),
                new Point(5, 9),
                new Point(10, 10)
        ));
        var filteredPoints = CurveSimplification.rdp(points, 1, new Dist());
        assertEquals(3, filteredPoints.size());
    }

    @Test
    public void complexSimplification() {
        var points = new ArrayList<Point>();
        for (double x = 0; x < 1000; x += 0.5)
            points.add(new Point(x, customSin(x, 0.1)));

        var filteredPoints = CurveSimplification.rdp(points, 0.1, new Dist());
        assertEquals(32, filteredPoints.size());
    }

    @Test
    public void complexNoSimplification() {
        var points = new ArrayList<Point>();
        for (double x = 0; x < 1000; x += 0.5)
            points.add(new Point(x, customSin(x, 10)));

        var filteredPoints = CurveSimplification.rdp(points, 0.1, new Dist());
        assertEquals(1876, filteredPoints.size());
    }
}