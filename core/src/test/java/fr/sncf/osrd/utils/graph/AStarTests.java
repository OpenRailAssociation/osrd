package fr.sncf.osrd.utils.graph;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.Sets;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import org.junit.jupiter.api.Disabled;
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
    @Disabled("See https://github.com/DGEXSolutions/osrd/pull/3908")
    public void notAllRoutesVisitedWithHeuristic() throws Exception {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var graph = infra.getSignalingRouteGraph();
        var firstRoute = infra.findSignalingRoute("rt.DA7_2->DA7_5", "BAL3");
        var lastRoute = infra.findSignalingRoute("rt.DH1_2->buffer_stop.7", "BAL3");
        var origin = Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0));
        var destination = Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 0));
        var remainingDistanceEstimator = new RemainingDistanceEstimator(destination);
        var seen = new HashSet<SignalingRoute>();
        new Pathfinding<>(new GraphAdapter<>(graph))
                .setEdgeToLength(x -> x.getInfraRoute().getLength())
                .setRemainingDistanceEstimator((route, offset) -> {
                    seen.add(route);
                    return remainingDistanceEstimator.apply(route, offset);
                })
                .runPathfinding(List.of(origin, destination));
        var allRoutes = allReachableRoutes(graph, origin);

        // We shouldn't visit all routes
        var notSeen = Sets.difference(allRoutes, seen);
        assertFalse(notSeen.isEmpty());
    }

    /** This is the same test as above but without heuristic. We check that all routes *are* visited, ensuring
     * the test above does need a good heuristic to pass. */
    @Test
    public void allRoutesVisitedWithoutHeuristic() throws Exception {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var graph = infra.getSignalingRouteGraph();
        var firstRoute = infra.findSignalingRoute("rt.DA7_2->DA7_5", "BAL3");
        var lastRoute = infra.findSignalingRoute("rt.DH1_2->buffer_stop.7", "BAL3");
        var origin = Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0));
        var destination = Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 0));
        var seen = new HashSet<SignalingRoute>();
        new Pathfinding<>(new GraphAdapter<>(graph))
                .setEdgeToLength(x -> x.getInfraRoute().getLength())
                .setRemainingDistanceEstimator((route, offset) -> {
                    seen.add(route);
                    return 0;
                })
                .runPathfinding(List.of(origin, destination));
        var allRoutes = allReachableRoutes(graph, origin);

        // We should visit all routes
        var notSeen = Sets.difference(allRoutes, seen);
        assertTrue(notSeen.isEmpty());
    }

    /** Returns all route that can be accessed from the origin point(s) */
    private Set<SignalingRoute> allReachableRoutes(
            ImmutableNetwork<DiDetector, SignalingRoute> graph,
            Collection<Pathfinding.EdgeLocation<SignalingRoute>> origin
    ) {
        var seen = new HashSet<SignalingRoute>();
        var res = new Pathfinding<>(new GraphAdapter<>(graph))
                .setEdgeToLength(x -> x.getInfraRoute().getLength())
                .setRemainingDistanceEstimator((route, offset) -> {
                    seen.add(route);
                    return 0;
                })
                .runPathfinding(List.of(
                        origin,
                        List.of(new Pathfinding.EdgeLocation<>(
                                new BAL3.BAL3Route(null, null, null),
                                0
                        ))
                ));
        assert res == null;
        return seen;
    }
}
