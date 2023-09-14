package fr.sncf.osrd.utils.graph;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.Sets;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator;
import org.junit.jupiter.api.Test;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class AStarTests {

    /** We try to find a path from a point on the center-west of the infra to the east most point.
     * The path is almost a geographic line, so with a good heuristic we shouldn't explore more than what
     * we need. But with no heuristic the destination would be the last point visited. We check that
     * there are routes left unvisited. */
    @Test
    public void notAllRoutesVisitedWithHeuristic() throws Exception {
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var origin = Set.of(Helpers.convertRouteLocation(infra, "rt.DA2->DA5", 0));
        var destination = Set.of(Helpers.convertRouteLocation(infra, "rt.DH2->buffer_stop.7", 0));
        var remainingDistanceEstimator = new RemainingDistanceEstimator(infra.blockInfra(), infra.rawInfra(),
                destination, 0.);
        var seen = new HashSet<Integer>();
        new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                .setEdgeToLength(blockId -> infra.blockInfra().getBlockLength(blockId))
                .setRemainingDistanceEstimator(List.of((block, offset) -> {
                    seen.add(block);
                    return remainingDistanceEstimator.apply(block, offset);
                }))
                .runPathfinding(List.of(origin, destination));
        var allRoutes = allReachableRoutes(infra, origin);

        // We shouldn't visit all routes
        var notSeen = Sets.difference(allRoutes, seen);
        assertFalse(notSeen.isEmpty());
    }

    /** This is the same test as above but without heuristic. We check that all routes *are* visited, ensuring
     * the test above does need a good heuristic to pass. */
    @Test
    public void allRoutesVisitedWithoutHeuristic() throws Exception {
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var origin = Set.of(Helpers.convertRouteLocation(infra, "rt.DA2->DA5", 0));
        var destination = Set.of(Helpers.convertRouteLocation(infra, "rt.DH2->buffer_stop.7", 0));
        var seen = new HashSet<Integer>();
        new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                .setEdgeToLength(blockId -> infra.blockInfra().getBlockLength(blockId))
                .setRemainingDistanceEstimator(List.of((block, offset) -> {
                    seen.add(block);
                    return 0;
                }))
                .runPathfinding(List.of(origin, destination));
        var allRoutes = allReachableRoutes(infra, origin);

        // We should visit all routes
        var notSeen = Sets.difference(allRoutes, seen);
        assertTrue(notSeen.isEmpty());
    }

    /** Returns all route that can be accessed from the origin point(s) */
    private Set<Integer> allReachableRoutes(
            FullInfra infra,
            Collection<Pathfinding.EdgeLocation<Integer>> origin
    ) {
        var seen = new HashSet<Integer>();
        var res = new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                .setEdgeToLength(blockId -> infra.blockInfra().getBlockLength(blockId))
                .setRemainingDistanceEstimator(List.of((block, offset) -> {
                    seen.add(block);
                    return 0;
                }))
                .runPathfinding(List.of(
                        origin,
                        List.of(new Pathfinding.EdgeLocation<>(
                                -1,
                                0
                        ))
                ));
        assert res == null;
        return seen;
    }
}
