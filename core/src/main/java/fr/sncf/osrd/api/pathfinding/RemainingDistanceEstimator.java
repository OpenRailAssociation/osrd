package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.api.pathfinding.PathfindingUtils.makePath;

import fr.sncf.osrd.geom.Point;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.AStarHeuristic;
import java.util.ArrayList;
import java.util.Collection;

/** This is a function object that estimates the remaining distance to the closest target point,
 * using geo data. It is used as heuristic for A*. */
public class RemainingDistanceEstimator implements AStarHeuristic<Integer> {

    private final Collection<Point> targets;
    private final double remainingDistance;

    /** Targets closer than this threshold will be merged together */
    private static final double distanceThreshold = 1.;
    private final RawSignalingInfra rawInfra;
    private final BlockInfra blockInfra;

    /** Constructor */
    public RemainingDistanceEstimator(
            BlockInfra blockInfra,
            RawSignalingInfra rawInfra,
            Collection<Pathfinding.EdgeLocation<Integer>> edgeLocations,
            double remainingDistance
    ) {
        targets = new ArrayList<>();
        this.rawInfra = rawInfra;
        this.blockInfra = blockInfra;
        for (var edgeLocation : edgeLocations) {
            var point = blockOffsetToPoint(blockInfra, rawInfra, edgeLocation.edge(), (long) edgeLocation.offset());
            // Avoid adding duplicate geo points to the target list
            if (targets.stream().noneMatch(target -> point.distanceAsMeters(target) < distanceThreshold)) {
                targets.add(point);
            }
        }
        this.remainingDistance = remainingDistance;
    }

    /** Converts a route and offset from its start into a geo point */
    private static Point blockOffsetToPoint(
            BlockInfra blockInfra,
            RawSignalingInfra rawInfra,
            int blockIdx,
            long pointOffset
    ) {
        var path = makePath(blockInfra, rawInfra, blockIdx);
        var lineString = path.getGeo();
        var normalizedOffset = ((double) pointOffset) / ((double) path.getLength());
        return lineString.interpolateNormalized(normalizedOffset);
    }

    /** Compute the minimum geo distance between two steps.
     * Expected to be used when instantiating the heuristic,
     * to estimate the remaining total distance for any step. */
    public static double minDistanceBetweenSteps(
            BlockInfra blockInfra,
            RawSignalingInfra rawInfra,
            Collection<Pathfinding.EdgeLocation<Integer>> step1,
            Collection<Pathfinding.EdgeLocation<Integer>> step2
    ) {
        var step1Points = step1.stream()
                .map(loc -> blockOffsetToPoint(blockInfra, rawInfra, loc.edge(), (long) loc.offset()))
                .toList();
        var step2Points = step2.stream()
                .map(loc -> blockOffsetToPoint(blockInfra, rawInfra, loc.edge(), (long) loc.offset()))
                .toList();

        var res = Double.POSITIVE_INFINITY;
        for (var point1: step1Points) {
            for (var point2: step2Points) {
                res = Double.min(res, point1.distanceAsMeters(point2));
            }
        }
        return res;
    }

    @Override
    public double apply(Integer blockIdx, double offset) {
        var res = Double.POSITIVE_INFINITY;
        var point = blockOffsetToPoint(this.blockInfra, this.rawInfra, blockIdx, (long) offset);
        for (var target : targets)
            res = Double.min(res, point.distanceAsMeters(target));
        return res + remainingDistance;
    }
}
