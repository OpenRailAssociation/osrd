package fr.sncf.osrd.api.pathfinding;

import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.railjson.schema.geom.Point;
import fr.sncf.osrd.utils.graph.functional_interfaces.AStarHeuristic;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.gavaghan.geodesy.Ellipsoid;
import org.gavaghan.geodesy.GeodeticCalculator;
import org.gavaghan.geodesy.GlobalPosition;
import java.util.Collection;

/** This is a function object that estimates the remaining distance to the closest target point,
 * using geo data. It is used as heuristic for A*. */
public class RemainingDistanceEstimator implements AStarHeuristic<SignalingRoute> {

    private final Collection<Point> targets;

    /** Constructor */
    public RemainingDistanceEstimator(Collection<Pathfinding.EdgeLocation<SignalingRoute>> edgeLocations) {
        targets = edgeLocations.stream()
                .map(loc -> routeOffsetToPoint(loc.edge(), loc.offset()))
                .toList();
    }

    /** Converts a route and offset from its start into a geo point */
    private Point routeOffsetToPoint(SignalingRoute route, double pointOffset) {
        for (var trackRange : route.getInfraRoute().getTrackRanges()) {
            if (pointOffset <= trackRange.getLength()) {
                var trackLocation = trackRange.offsetLocation(pointOffset);
                var normalizedOffset = trackLocation.offset() / trackLocation.track().getLength();
                var geo = trackLocation.track().getGeo();
                if (geo == null)
                    return new Point(0, 0);
                return geo.interpolateNormalized(normalizedOffset);
            }
            pointOffset -= trackRange.getLength();
        }
        throw new RuntimeException("Couldn't find offset on route");
    }

    private double normalizeAngleDeg(double angle) {
        // reduce the angle
        angle =  angle % 360;

        // force it to be the positive remainder, so that 0 <= angle < 360
        angle = (angle + 360) % 360;

        // force into the minimum absolute value residue class, so that -180 < angle <= 180
        if (angle > 180)
            angle -= 360;
        return angle;
    }

    private double cost(Point currentLoc, Point routeEnd, Point target) {
        GeodeticCalculator geoCalc = new GeodeticCalculator();
        Ellipsoid reference = Ellipsoid.WGS84;

        GlobalPosition curPos = new GlobalPosition(currentLoc.y(), currentLoc.x(), 0.0);
        GlobalPosition targetPos = new GlobalPosition(target.y(), target.x(), 0.0);
        GlobalPosition routeEndPos = new GlobalPosition(routeEnd.y(), routeEnd.x(), 0.0);

        var targetCurve = geoCalc.calculateGeodeticCurve(reference, curPos, targetPos);
        var targetDistance = targetCurve.getEllipsoidalDistance();
        var targetAngle = targetCurve.getAzimuth();
        var routeEndCurve = geoCalc.calculateGeodeticCurve(reference, curPos, routeEndPos);
        var routeEndAngle = routeEndCurve.getAzimuth();
        var angleDelta = normalizeAngleDeg(targetAngle - routeEndAngle);
        if (Double.isNaN(angleDelta))
            return targetDistance;
        var angleScore = Math.abs(angleDelta / 180.); // an angle difference score between 0 and 1
        assert angleScore >= 0. && angleScore <= 1.;
        return targetDistance * angleScore;
    }

    @Override
    public double apply(SignalingRoute signalingRoute, double offset) {
        var routeRanges = signalingRoute.getInfraRoute().getTrackRanges();
        var lastRange = routeRanges.get(routeRanges.size() - 1);
        var trackSection = lastRange.track.getEdge();
        var geo = trackSection.getGeo();
        if (geo == null)
            return 0;
        var routeEndPoint = geo.interpolateNormalized(lastRange.getStop() / trackSection.getLength());

        var res = Double.POSITIVE_INFINITY;
        var point = routeOffsetToPoint(signalingRoute, offset);
        for (var target : targets)
            res = Double.min(res, cost(point, routeEndPoint, target));
        return res;
    }
}
