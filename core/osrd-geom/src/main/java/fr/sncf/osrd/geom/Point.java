package fr.sncf.osrd.geom;

import static java.lang.Math.*;

public record Point(
        // Longitude
        double x,
        // Latitude
        double y) {

    /**
     * Returns the distance between this point and another in meters, assuming x = longitude and y =
     * latitude. Uses equirectangular distance approximation (very fast but not 100% accurate)
     */
    public double distanceAsMeters(Point other) {
        final var earthRadius = 6_378_160;
        var lon1 = toRadians(x);
        var lon2 = toRadians(other.x);
        var lat1 = toRadians(y);
        var lat2 = toRadians(other.y);
        var xDiff = (lon1 - lon2) * cos(0.5 * (lat1 + lat2));
        var yDiff = lat1 - lat2;
        return earthRadius * sqrt(xDiff * xDiff + yDiff * yDiff);
    }

    @Override
    public String toString() {
        return String.format("{x=%f, y=%f}", x, y);
    }
}
