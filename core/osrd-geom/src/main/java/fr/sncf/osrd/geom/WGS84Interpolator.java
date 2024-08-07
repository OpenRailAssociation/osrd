package fr.sncf.osrd.geom;

public class WGS84Interpolator {

    public static final double EARTH_RADIUS = 6_378_160;

    private record EPSG3857Point(double x, double y) {
        static EPSG3857Point from(Point p) {
            double x = Math.toRadians(p.lon()) * EARTH_RADIUS;
            double y = Math.log(Math.tan(Math.PI / 4 + Math.toRadians(p.lat()) / 2)) * EARTH_RADIUS;
            return new EPSG3857Point(x, y);
        }

        Point toWGS84() {
            double lat = Math.toDegrees(Math.atan(Math.exp(y / EARTH_RADIUS)) * 2 - Math.PI / 2);
            double lon = Math.toDegrees(x / EARTH_RADIUS);
            return new Point(lat, lon);
        }
    }

    /** Interpolates between two points. We project to EPSG:3857 to interpolate linearly there,
     * it's not quite correct but interpolating on a straight line will be displayed properly
     * when shown on maps. */
    public static Point interpolate(Point p1, Point p2, double fraction) {
        var projectedP1 = EPSG3857Point.from(p1);
        var projectedP2 = EPSG3857Point.from(p2);
        var interpolated = new EPSG3857Point(
                projectedP1.x + (projectedP2.x - projectedP1.x) * fraction,
                projectedP1.y + (projectedP2.y - projectedP1.y) * fraction);
        return interpolated.toWGS84();
    }
}
