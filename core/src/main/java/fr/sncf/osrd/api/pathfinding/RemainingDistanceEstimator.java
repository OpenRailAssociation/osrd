package fr.sncf.osrd.api.pathfinding;

import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.railjson.schema.geom.Point;
import fr.sncf.osrd.utils.graph.functional_interfaces.AStarHeuristic;
import fr.sncf.osrd.utils.graph.Pathfinding;
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

    @Override
    public double apply(SignalingRoute signalingRoute, double offset) {
        var res = Double.POSITIVE_INFINITY;
        var point = routeOffsetToPoint(signalingRoute, offset);
        for (var target : targets)
            res = Double.min(res, point.distanceAsMeters(target));
        return res;
    }
}
