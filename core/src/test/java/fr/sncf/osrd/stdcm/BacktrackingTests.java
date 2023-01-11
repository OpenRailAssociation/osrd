package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.graph.STDCMSimulations;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class BacktrackingTests {

    /** This test requires some backtracking to compute the final braking curve.
     * With a naive approach we reach the destination in time, but the extra braking curve makes us
     * reach the next block */
    @Test
    public void testBacktrackingBrakingCurve() {
        /*
        a ------> b
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var route = infraBuilder.addRoute("a", "b", 1000);
        var firstRouteEnvelope = STDCMSimulations.simulateRoute(route, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert firstRouteEnvelope != null;
        var runTime = firstRouteEnvelope.getTotalTime();
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                route, new OccupancyBlock(runTime + 1, POSITIVE_INFINITY, 0, 1000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 1_000)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        if (res == null)
            return;
        STDCMHelpers.occupancyTest(res, occupancyGraph);
    }

    /** This is the same test as the one above, but with the braking curve spanning over several routes */
    @Test
    public void testBacktrackingBrakingCurveSeveralRoutes() {
        /*
        a ------> b -> c -> d -> e
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        infraBuilder.addRoute("b", "c", 10);
        infraBuilder.addRoute("c", "d", 10);
        var lastRoute = infraBuilder.addRoute("d", "e", 10);
        var firstRouteEnvelope = STDCMSimulations.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert firstRouteEnvelope != null;
        var runTime = firstRouteEnvelope.getTotalTime();
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                lastRoute, new OccupancyBlock(runTime + 10, POSITIVE_INFINITY, 0, 10)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 5)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        if (res == null)
            return;
        STDCMHelpers.occupancyTest(res, occupancyGraph);
    }

    /** Test that we don't stay in the first route for too long when there is an MRSP drop at the route transition */
    @Test
    public void testBacktrackingMRSPDrop() {
        /*
        a ------> b -> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        var secondRoute = infraBuilder.addRoute("b", "c", 100, 5);
        var firstRouteEnvelope = STDCMSimulations.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert firstRouteEnvelope != null;
        var runTime = firstRouteEnvelope.getTotalTime();
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(runTime + 10, POSITIVE_INFINITY, 0, 1000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 5)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        if (res == null)
            return;
        STDCMHelpers.occupancyTest(res, occupancyGraph);
    }

    /** Test that we can backtrack several times over the same edges */
    @Test
    public void testManyBacktracking() {
        /*
        a ------> b -> c -> d -> e ----> f

        Long first route for speedup, then the MRSP drops at each (short) route
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 10000);
        infraBuilder.addRoute("b", "c", 10, 20);
        infraBuilder.addRoute("c", "d", 10, 15);
        infraBuilder.addRoute("d", "e", 10, 10);
        var lastRoute = infraBuilder.addRoute("e", "f", 1000, 5);
        var infra = infraBuilder.build();
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1_000)))
                .run();
        assert res != null;
        assertTrue(res.envelope().continuous);
    }
}
