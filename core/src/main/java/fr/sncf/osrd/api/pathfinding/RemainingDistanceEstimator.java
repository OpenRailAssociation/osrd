package fr.sncf.osrd.api.pathfinding;

import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.geom.Point;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Collection;
import java.util.function.BiFunction;

public class RemainingDistanceEstimator implements BiFunction<SignalingRoute, Double, Double> {

    private final Collection<Point> targets;

    /** Constructor */
    public RemainingDistanceEstimator(Collection<Pathfinding.EdgeLocation<SignalingRoute>> edgeLocations) {
        targets = edgeLocations.stream()
                .map(loc -> routeOffsetToPoint(loc.edge(), loc.offset()))
                .toList();
    }

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
    public Double apply(SignalingRoute signalingRoute, Double offset) {
        var res = Double.POSITIVE_INFINITY;
        var point = routeOffsetToPoint(signalingRoute, offset);
        for (var target : targets)
            res = Double.min(res, point.distance(target));
        return res;
    }
}
