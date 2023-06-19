package fr.sncf.osrd.geom;

import org.gavaghan.geodesy.*;

public record Point (
        // Longitude
        double x,
        // Latitude
        double y
) {

    /** Returns the distance between this point and another in meters,
     * assuming x = longitude and y = latitude */
    public double distanceAsMeters(Point other) {
        GeodeticCalculator geoCalc = new GeodeticCalculator();
        Ellipsoid reference = Ellipsoid.WGS84;
        GlobalPosition thisPosition = new GlobalPosition(y, x, 0.0);
        GlobalPosition otherPosition = new GlobalPosition(other.y, other.x, 0.0);
        return geoCalc.calculateGeodeticCurve(reference, thisPosition, otherPosition).getEllipsoidalDistance();
    }

    @Override
    public String toString() {
        return String.format("{x=%f, y=%f}", x, y);
    }
}
