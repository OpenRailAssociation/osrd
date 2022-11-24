package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.*;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.*;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.graph.STDCMPathfinding;
import fr.sncf.osrd.api.stdcm.STDCMResult;
import fr.sncf.osrd.api.stdcm.graph.STDCMUtils;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public class STDCMPathfindingTests {

    /** Look for a path in an empty timetable */
    @Test
    public void emptyTimetable() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
    }

    /** Look for a path where the routes are occupied before and after */
    @Test
    public void betweenTrains() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(0, 50, 0, 100),
                firstRoute, new OccupancyBlock(10000, POSITIVE_INFINITY, 0, 100),
                secondRoute, new OccupancyBlock(0, 50, 0, 100),
                secondRoute, new OccupancyBlock(10000, POSITIVE_INFINITY, 0, 100));
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
    }

    /** Test that no path is found when the routes aren't connected */
    @Test
    public void disconnectedRoutes() {
        /*
        a --> b

        x --> y
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("x", "y");
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 0)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNull(res);
    }

    /** Test that no path is found if the first route is free for a very short interval */
    @Test
    public void impossiblePath() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(0, 99, 0, 100),
                firstRoute, new OccupancyBlock(101, POSITIVE_INFINITY, 0, 100),
                secondRoute, new OccupancyBlock(0, 50, 0, 100),
                secondRoute, new OccupancyBlock(1000, POSITIVE_INFINITY, 0, 100));
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNull(res);

    }

    /** Test that we can find a path even if the last route is occupied when the train starts */
    @Test
    public void lastRouteOccupiedAtStart() {
        /*
        a ------> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                secondRoute, new OccupancyBlock(0, 10, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
    }

    /** Tests that an occupied route can cause delays */
    @Test
    @Disabled
    public void intermediateRouteCausingDelays() {
        /*
        a --> b --> c --> d
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var intermediateRoute = infraBuilder.addRoute("b", "c");
        var lastRoute = infraBuilder.addRoute("c", "d");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                intermediateRoute, new OccupancyBlock(0, 1000, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
        assert res.envelope().getTotalTime() >= 1000;
        occupancyTest(res, occupancyGraph);
    }

    /** Test that the path can change depending on the occupancy */
    @Test
    public void testAvoidBlockedRoutes() {
        /*
                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2

        We occupy either side and check that the path goes through the other one
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        infraBuilder.addRoute("a", "b");
        var routeTop = infraBuilder.addRoute("b", "c1");
        var routeBottom = infraBuilder.addRoute("b", "c2");
        infraBuilder.addRoute("c1", "d");
        infraBuilder.addRoute("c2", "d");
        infraBuilder.addRoute("d", "e");
        var infra = infraBuilder.build();
        var occupancyGraph1 = ImmutableMultimap.of(
                routeTop, new OccupancyBlock(0, POSITIVE_INFINITY, 0, 100)
        );
        var occupancyGraph2 = ImmutableMultimap.of(
                routeBottom, new OccupancyBlock(0, POSITIVE_INFINITY, 0, 100)
        );

        var firstRoute = infra.findSignalingRoute("a->b", "BAL3");
        var lastRoute = infra.findSignalingRoute("d->e", "BAL3");

        var res1 = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)),
                occupancyGraph1,
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        var res2 = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)),
                occupancyGraph2,
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res1);
        assertNotNull(res2);
        final var routes1 = res1.routes().ranges().stream()
                .map(route -> route.edge().getInfraRoute().getID()).toList();
        final var routes2 = res2.routes().ranges().stream()
                .map(route -> route.edge().getInfraRoute().getID()).toList();

        assertFalse(routes1.contains("b->c1"));
        assertTrue(routes1.contains("b->c2"));
        occupancyTest(res1, occupancyGraph1);

        assertFalse(routes2.contains("b->c2"));
        assertTrue(routes2.contains("b->c1"));
        occupancyTest(res2, occupancyGraph2);
    }

    /** Test that everything works well when the train is at max speed during route transitions */
    @Test
    public void veryLongPathTest() {
        /*
        a ------> b -----> c ------> d
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 10000);
        infraBuilder.addRoute("b", "c", 10000);
        var lastRoute = infraBuilder.addRoute("c", "d", 10000);
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 9000)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
    }

    /** Test that we avoid a path that the train can't use because of a high slope */
    @Test
    public void testAvoidImpossiblePath() {
        /*
                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        infraBuilder.addRoute("a", "b");
        infraBuilder.addRoute("b", "c1");
        infraBuilder.addRoute("b", "c2");
        var routeTop = infraBuilder.addRoute("c1", "d");
        infraBuilder.addRoute("c2", "d");
        infraBuilder.addRoute("d", "e");
        var infra = infraBuilder.build();
        var track = routeTop.getInfraRoute().getTrackRanges().get(0).track.getEdge();
        track.getGradients().put(Direction.FORWARD, TreeRangeMap.create());
        track.getGradients().get(Direction.FORWARD).put(Range.closed(0., track.getLength()), 1000.);

        var firstRoute = infra.findSignalingRoute("a->b", "BAL3");
        var lastRoute = infra.findSignalingRoute("d->e", "BAL3");

        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
    }

    /** Test that we can add delays to avoid occupied sections */
    @Test
    public void testSimpleDelay() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                secondRoute, new OccupancyBlock(0, 3600, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
        var secondRouteEntryTime = res.departureTime()
                + res.envelope().interpolateTotalTime(firstRoute.getInfraRoute().getLength());
        assertTrue(secondRouteEntryTime >= 3600);
        occupancyTest(res, occupancyGraph);
    }

    /** Test that we can add delays to avoid several occupied blocks */
    @Test
    public void testSimpleSeveralBlocks() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                secondRoute, new OccupancyBlock(0, 1200, 0, 100),
                secondRoute, new OccupancyBlock(1200, 2400, 0, 100),
                secondRoute, new OccupancyBlock(2400, 3600, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        var secondRouteEntryTime = res.departureTime()
                + res.envelope().interpolateTotalTime(firstRoute.getInfraRoute().getLength());
        assertTrue(secondRouteEntryTime >= 3600);

        occupancyTest(res, occupancyGraph);
    }

    /** Test that the path we find is the one with the earliest arrival time rather than the shortest */
    @Test
    public void testEarliestArrivalTime() {
        /*
        Top path is shorter but has a very low speed limit
        We should use the bottom path (higher speed limit)
        First and last routes are very long for speedup and slowdown

                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        infraBuilder.addRoute("b", "c1", 50, 1);
        infraBuilder.addRoute("b", "c2");
        infraBuilder.addRoute("c1", "d", 50, 1);
        infraBuilder.addRoute("c2", "d");
        var lastRoute = infraBuilder.addRoute("d", "e", 1000);
        var infra = infraBuilder.build();

        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1000)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        var routes = res.routes().ranges().stream()
                .map(edgeRange -> edgeRange.edge().getInfraRoute().getID())
                .collect(Collectors.toSet());
        assertTrue(routes.contains("b->c2"));
        assertTrue(routes.contains("c2->d"));
        assertFalse(routes.contains("b->c1"));
        assertFalse(routes.contains("c1->d"));
    }

    /** Test that the path we find is the one with the earliest arrival time rather than the shortest
     * while taking into account departure time delay caused by the first block occupancy */
    @Test
    public void testEarliestArrivalTimeWithOccupancy() {
        /*
        Bop path is shorter but is occupied at start
        Tot path is longer but can be used with no delay
        We should use the top path (earlier arrival time)
        First and last routes are very long for speedup and slowdown

                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        infraBuilder.addRoute("b", "c1");
        var delayedRoute = infraBuilder.addRoute("b", "c2", 50);
        infraBuilder.addRoute("c1", "d");
        infraBuilder.addRoute("c2", "d");
        var lastRoute = infraBuilder.addRoute("d", "e", 1000);
        var infra = infraBuilder.build();

        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1000)),
                ImmutableMultimap.of(delayedRoute, new OccupancyBlock(
                        0,
                        10000,
                        0,
                        50)
                ),
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        var routes = res.routes().ranges().stream()
                .map(edgeRange -> edgeRange.edge().getInfraRoute().getID())
                .collect(Collectors.toSet());
        assertTrue(routes.contains("b->c1"));
        assertTrue(routes.contains("c1->d"));
        assertFalse(routes.contains("b->c2"));
        assertFalse(routes.contains("c2->d"));
    }

    /** Test that we don't add too much delay, crossing over occupied sections in previous routes */
    @Test
    public void testImpossibleAddedDelay() {
        /*
        a --> b --> c --> d
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var firstRouteEnvelope = STDCMUtils.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, 2, new double[]{}, Set.of());
        assert firstRouteEnvelope != null;
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 100)),
                ImmutableMultimap.of(
                        firstRoute, new OccupancyBlock(
                                firstRouteEnvelope.getTotalTime() + 10,
                                POSITIVE_INFINITY,
                                0, 100),
                        secondRoute, new OccupancyBlock(0, 3600, 0, 100)
                ),
                2.,
                3600 * 2,
                Double.POSITIVE_INFINITY,
                Set.of()
        );
        assertNull(res);
    }

    /** Test that we can backtrack when the first "opening" doesn't lead to a valid solution.
     * To do this, we need to consider that the same route at different times can be different edges */
    @Test
    public void testDifferentOpenings() {
        /*
        a --> b --> c --> d

        space
          ^
        d |##############   end
          |##############   /
        c |##############__/____
          |   x     ##### /
        b |__/______#####/______
          | /           /
        a start________/_______> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var thirdRoute = infraBuilder.addRoute("c", "d");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                secondRoute, new OccupancyBlock(300, 500, 0, 100),
                thirdRoute, new OccupancyBlock(0, 500, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(thirdRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
    }

    /** This is the same test as the one above, but with the split on the first route. */
    @Test
    public void testTwoOpeningsFirstRoute() {
        /*
        a --> b --> c

        space
          ^
        c |##############   end
          |##############   /
        b |##############__/____
          | x       ##### /
        a |/________#####/______> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(300, 500, 0, 100),
                secondRoute, new OccupancyBlock(0, 500, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
    }

    /** This is the same test as the one above, but with the split on the last route. */
    @Test
    public void testTwoOpeningsLastRoute() {
        /*
        a --> b --> c

        space
          ^
        c |    x    ##### end
          |___/_____#####_/_____
        b |__/______#####/______
          | /           /
        a start________/_______> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                secondRoute, new OccupancyBlock(300, 500, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
    }

    /** Test that we keep track of how much we can shift the departure time over several routes */
    @Test
    public void testMaximumShiftMoreRestrictive() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        e |######################################__/___
          |###################################### /
        d |######################################/_____
          |                                     /
        c |____________________________________x_______
          |                     #######################
        b |_____________________#######################
          |                                    ########
        a start________________________________########> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        infraBuilder.addRoute("c", "d", 1); // Very short to prevent slowdowns
        var forthRoute = infraBuilder.addRoute("d", "e");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(1200, POSITIVE_INFINITY, 0, 100),
                secondRoute, new OccupancyBlock(600, POSITIVE_INFINITY, 0, 100),
                forthRoute, new OccupancyBlock(0, 1000, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(forthRoute, 1)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        assertNull(res);
    }

    /** We shift de departure time a little more at each route,
     * we test that we still keep track of how much we can shift.
     * This test may need tweaking / removal once we consider slowdowns. */
    @Test
    public void testMaximumShiftWithDelays() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        e |################################ end
          |################################/__________
        d |#################### /         /
          |####################/_________/____________
        c |############# /              /
          |#############/______________x______________
        b |#####  /                ###################
          |#####/                  ###################
        a start____________________###################_> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var thirdRoute = infraBuilder.addRoute("c", "d");
        var forthRoute = infraBuilder.addRoute("d", "e");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(0, 200, 0, 100),
                firstRoute, new OccupancyBlock(500, POSITIVE_INFINITY, 0, 100),
                secondRoute, new OccupancyBlock(0, 400, 0, 100),
                thirdRoute, new OccupancyBlock(0, 600, 0, 100),
                forthRoute, new OccupancyBlock(0, 800, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(forthRoute, 1)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        assertNull(res);
    }

    /** Test that we can consider more than two openings */
    @Test
    public void testSeveralOpenings() {
        /*
        a --> b --> c --> d

        space
          ^
        d |##########################_______################
          |##########################  end  ################
        c |##########################__/____################
          |   x     ##### x     ##### /     ##### x
        b |__/______#####/______#####/______#####/__________
          | /           /                       /
        a start________/_______________________/_____________> time
                    |   |       |    |      |    |          |
                   300 600     900  1200   1500 1800       inf   (s)
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var thirdRoute = infraBuilder.addRoute("c", "d");
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                secondRoute, new OccupancyBlock(300, 600, 0, 100),
                secondRoute, new OccupancyBlock(900, 1200, 0, 100),
                secondRoute, new OccupancyBlock(1500, 1800, 0, 100),
                thirdRoute, new OccupancyBlock(0, 1200, 0, 100),
                thirdRoute, new OccupancyBlock(1500, POSITIVE_INFINITY, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(thirdRoute, 1)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
    }

    /** Test that we don't enter infinite loops */
    @Test
    public void testImpossiblePathWithLoop() {
        /*
        a --> b
        ^----/

        x --> y
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstLoop = infraBuilder.addRoute("a", "b");
        infraBuilder.addRoute("b", "a");
        var disconnectedRoute = infraBuilder.addRoute("x", "y");
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstLoop, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(disconnectedRoute, 0)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        assertNull(res);
    }

    /** Test that we don't add more delay than specified */
    @Test
    public void testMaximumDepartureTimeDelay() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var lastRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var res1 = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 0)),
                ImmutableMultimap.of(
                        firstRoute, new OccupancyBlock(0, 1000, 0, 100)
                ),
                2.,
                1001,
                POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res1);

        var res2 = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 0)),
                ImmutableMultimap.of(
                        firstRoute, new OccupancyBlock(0, 1000, 0, 100)
                ),
                2.,
                999,
                POSITIVE_INFINITY,
                Set.of()
        );
        assertNull(res2);
    }

    /** Test that we check that the total run time doesn't exceed the threshold if it happens after the edge start */
    @Test
    public void testTotalRunTimeLongEdge() {
        /*
        a ---------> b
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var route = infraBuilder.addRoute("a", "b", 10000);
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(route, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(route, 10000)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                100,
                Set.of()
        );
        assertNull(res);
    }

    /** Test that we check that the total run time doesn't exceed the threshold with many small edges */
    @Test
    public void testTotalRunTimeShortEdges() {
        /*
        1 --> 2 --> ... --> 10
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var routes = new ArrayList<SignalingRoute>();
        for (int i = 0; i < 10; i++)
            routes.add(infraBuilder.addRoute(Integer.toString(i + 1), Integer.toString(i + 2), 1000));
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 0)),
                Set.of(new Pathfinding.EdgeLocation<>(routes.get(9), 1000)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                100,
                Set.of()
        );
        assertNull(res);
    }

    /** Test that the start delay isn't included in the total run time */
    @Test
    public void testMaxRunTimeWithDelay() {
        /*
        a --> b
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var route = infraBuilder.addRoute("a", "b");
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(route, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(route, 100)),
                ImmutableMultimap.of(
                        route, new OccupancyBlock(0, 1000, 0, 100)
                ),
                2.,
                1000,
                100,
                Set.of()
        );
        assertNotNull(res);
    }

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
        var firstRouteEnvelope = STDCMUtils.simulateRoute(route, 0, 0,
                REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of());
        assert firstRouteEnvelope != null;
        var runTime = firstRouteEnvelope.getTotalTime();
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                route, new OccupancyBlock(runTime + 1, POSITIVE_INFINITY, 0, 1000)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(route, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(route, 1000)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        if (res == null)
            return;
        occupancyTest(res, occupancyGraph);
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
        var firstRouteEnvelope = STDCMUtils.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of());
        assert firstRouteEnvelope != null;
        var runTime = firstRouteEnvelope.getTotalTime();
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                lastRoute, new OccupancyBlock(runTime + 10, POSITIVE_INFINITY, 0, 10)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 5)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        if (res == null)
            return;
        occupancyTest(res, occupancyGraph);
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
        var firstRouteEnvelope = STDCMUtils.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of()
        );
        assert firstRouteEnvelope != null;
        var runTime = firstRouteEnvelope.getTotalTime();
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(runTime + 10, POSITIVE_INFINITY, 0, 1000)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 5)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        if (res == null)
            return;
        occupancyTest(res, occupancyGraph);
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
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1000)),
                ImmutableMultimap.of(),
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        assert res != null;
        assertTrue(res.envelope().continuous);
    }

    /** Test that we ignore occupancy that happen after the end goal */
    @Test
    @Disabled("TODO")
    public void testOccupancyEnvelopeLengthBlockSize() {
        /*
        a -(start) -> (end) ---------------[occupied]---------> b

        The route is occupied after the destination
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var route = infraBuilder.addRoute("a", "b", 100_000);
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(route, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(route, 10)),
                ImmutableMultimap.of(
                        route, new OccupancyBlock(0, POSITIVE_INFINITY, 99_000, 100_000)
                ),
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
    }

    /** Test that we don't use the full route envelope when the destination is close to the start */
    @Test
    @Disabled("TODO")
    public void testOccupancyEnvelopeLength() {
        /*
        a -(start) -> (end) ------------------------> b

        The destination is reached early and the route is occupied after a while
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var route = infraBuilder.addRoute("a", "b", 100_000);
        var infra = infraBuilder.build();
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(route, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(route, 10)),
                ImmutableMultimap.of(
                        route, new OccupancyBlock(300, POSITIVE_INFINITY, 0, 100_000)
                ),
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
    }

    /** Test that we can add an engineering allowance to avoid an occupied section */
    @Test
    public void testSlowdown() {
        /*
        a --> b --> c --> d

        space
          ^
        d |######### end
          |######### /
        c |#########/
          |     __/
        b |  __/
          | /##################
        a |/_##################_> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1_000, 30);
        var secondRoute = infraBuilder.addRoute("b", "c", 10_000, 30);
        var thirdRoute = infraBuilder.addRoute("c", "d", 100, 30);
        var firstRouteEnvelope = STDCMUtils.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of());
        assert firstRouteEnvelope != null;
        var secondRouteEnvelope = STDCMUtils.simulateRoute(secondRoute, firstRouteEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of());
        assert secondRouteEnvelope != null;
        var timeThirdRouteFree = firstRouteEnvelope.getTotalTime() + secondRouteEnvelope.getTotalTime();
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(firstRouteEnvelope.getTotalTime() + 10, POSITIVE_INFINITY, 0, 1_000),
                thirdRoute, new OccupancyBlock(0, timeThirdRouteFree + 30, 0, 100)
        );
        double timeStep = 2;
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(thirdRoute, 0)),
                occupancyGraph,
                timeStep,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
        assertEquals(10, res.departureTime(), 2 * timeStep);
    }

    /** Test that we can add an engineering allowance over several routes to avoid an occupied section */
    @Test
    public void testSlowdownSeveralRoutes() {
        /*
        a --> b --> c --> d --> e --> f

        space
          ^
        f |##################### end
          |##################### /
        e |#####################/
          |                 __/
        d |              __/
          |           __/
        c |        __/
          |     __/
        b |  __/
          | /##################
        a |/_##################_> time

         */
        final var infraBuilder = new DummyRouteGraphBuilder();
        final var firstRoute = infraBuilder.addRoute("a", "b", 1_000, 20);
        final var secondRoute = infraBuilder.addRoute("b", "c", 1_000, 20);
        infraBuilder.addRoute("c", "d", 1_000, 20);
        infraBuilder.addRoute("d", "e", 1_000, 20);
        var lastRoute = infraBuilder.addRoute("e", "f", 1_000, 20);
        var firstRouteEnvelope = STDCMUtils.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of());
        assert firstRouteEnvelope != null;
        var secondRouteEnvelope = STDCMUtils.simulateRoute(secondRoute, firstRouteEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of());
        assert secondRouteEnvelope != null;
        var timeLastRouteFree = firstRouteEnvelope.getTotalTime() + 120 + secondRouteEnvelope.getTotalTime() * 3;
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(firstRouteEnvelope.getTotalTime(), POSITIVE_INFINITY, 0, 1_000),
                lastRoute, new OccupancyBlock(0, timeLastRouteFree, 0, 1_000)
        );
        double timeStep = 2;
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1_000)),
                occupancyGraph,
                timeStep,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
        assertEquals(0, res.departureTime(), 2 * timeStep);
    }

    /** Test that allowances don't cause new conflicts */
    @Test
    public void testSlowdownWithConflicts() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        f |##################### end
          |##################### /
        e |#####################/
          |             ______/
        d |       _____/ __/
          |     / ####__/######
        c |    /  #__/#########
          |   / __/
        b |  __/
          | /##################
        a |/_##################_> time

        A naive allowance extending until we reach the constraints on either side
        would cross the occupancy in the "d->d" route (rightmost curve).

        But another solution exists: keeping the allowance in the "d->e" route (leftmost curve)

         */
        final var infraBuilder = new DummyRouteGraphBuilder();
        final var firstRoute = infraBuilder.addRoute("a", "b", 1_000, 20);
        final var secondRoute = infraBuilder.addRoute("b", "c", 1_000, 20);
        final var thirdRoute = infraBuilder.addRoute("c", "d", 1_000, 20);
        infraBuilder.addRoute("d", "e", 1_000, 20);
        var lastRoute = infraBuilder.addRoute("e", "f", 1_000, 20);
        var firstRouteEnvelope = STDCMUtils.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of());
        assert firstRouteEnvelope != null;
        var secondRouteEnvelope = STDCMUtils.simulateRoute(secondRoute, firstRouteEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, 2., new double[]{}, Set.of());
        assert secondRouteEnvelope != null;
        var timeLastRouteFree = firstRouteEnvelope.getTotalTime() + 120 + secondRouteEnvelope.getTotalTime() * 3;
        var timeThirdRouteOccupied = firstRouteEnvelope.getTotalTime() + 5 + secondRouteEnvelope.getTotalTime() * 2;
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(firstRouteEnvelope.getTotalTime(), POSITIVE_INFINITY, 0, 1_000),
                lastRoute, new OccupancyBlock(0, timeLastRouteFree, 0, 1_000),
                thirdRoute, new OccupancyBlock(timeThirdRouteOccupied, POSITIVE_INFINITY, 0, 1_000)
        );
        double timeStep = 2;
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1_000)),
                occupancyGraph,
                timeStep,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
        assertEquals(0, res.departureTime(), 2 * timeStep);
    }

    /** Test that we can add the max delay by shifting the departure time, then add more delay by slowing down */
    @Test
    public void testMaxDepartureTimeShift() {
        /*
        a --> b --> c --> d

        space
          ^
        d |###############
          |###############
        c |###############x end
          |            __/
        b |         __/
          |      __/
        a |_____/____________________> time
          |-----|
             ^
     max delay at departure time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1_000, 30);
        var secondRoute = infraBuilder.addRoute("b", "c", 1_000, 30);
        var thirdRoute = infraBuilder.addRoute("c", "d", 1, 30);
        var lastRouteEntryTime = getRoutesRunTime(List.of(firstRoute, secondRoute), REALISTIC_FAST_TRAIN);
        var timeThirdRouteFree = lastRouteEntryTime + 3600 * 2 + 60;
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                thirdRoute, new OccupancyBlock(0, timeThirdRouteFree, 0, 1)
        );
        double timeStep = 2;
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(thirdRoute, 0)),
                occupancyGraph,
                timeStep,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
        assertEquals(3600 * 2, res.departureTime(), 2 * timeStep);
        assertTrue(res.departureTime() <= 3600 * 2);
    }

    /** The allowance happens in an area where we have added delay by shifting the departure time */
    @Test
    public void testAllowanceWithDepartureTimeShift() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        e |##########################     ###### end
          |##########################     ######/__________
        d |#################### /              /
          |####################/_____     ____/____________
        c |############# /           [...]   /
          |#############/____________     __x______________
        b |#####  /                ##     #################
          |#####/                  ##     #################
        a start____________________##     #################_> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 2_000, 20);
        var secondRoute = infraBuilder.addRoute("b", "c", 2_000, 20);
        var thirdRoute = infraBuilder.addRoute("c", "d", 2_000, 20);
        var forthRoute = infraBuilder.addRoute("d", "e", 2_000, 20);
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(0, 600, 0, 100),
                firstRoute, new OccupancyBlock(2_000, POSITIVE_INFINITY, 0, 100),
                secondRoute, new OccupancyBlock(0, 1200, 0, 100),
                thirdRoute, new OccupancyBlock(0, 1800, 0, 100),
                forthRoute, new OccupancyBlock(0, 4_000, 0, 100)
        );
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(forthRoute, 1)),
                occupancyGraph,
                2.,
                3600 * 2,
                POSITIVE_INFINITY,
                Set.of()
        );
        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
    }

    /** Test that we return null with no crash when we can't slow down fast enough */
    @Test
    public void testImpossibleEngineeringAllowance() {
        /*
        a ------> b -> c -----> d

        space
          ^
        d |##################### end
          |#####################
        c |#########x###########
          |      __/
        b |   __/
          |  /#######################
        a |_/_#######################> time

        The second route is very short and not long enough to slow down

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var routes = List.of(
                infraBuilder.addRoute("a", "b", 1_000),
                infraBuilder.addRoute("b", "c", 1),
                infraBuilder.addRoute("c", "d", 1_000)
        );
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                routes.get(0), new OccupancyBlock(300, POSITIVE_INFINITY, 0, 1_000),
                routes.get(2), new OccupancyBlock(0, 3600, 0, 1_000)
        );
        double timeStep = 2;
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 0)),
                Set.of(new Pathfinding.EdgeLocation<>(routes.get(2), 1_000)),
                occupancyGraph,
                timeStep,
                POSITIVE_INFINITY,
                POSITIVE_INFINITY,
                Set.of()
        );

        assertNull(res);
    }

    /** Test that we can visit the same "opening" several times at very different times */
    @Test
    public void testVisitSameOpeningDifferentTimes() {
        /*
        a --> b --> c --> d

        space
          ^
        d |#####################    end
          |#####################     /
        c |#####################    /
          |    x                   /
        b |   /                   /
          |  /################## /
        a |_/_##################/____> time

        Allowances have been disabled (by setting max run time)

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var routes = List.of(
                infraBuilder.addRoute("a", "b"),
                infraBuilder.addRoute("b", "c"),
                infraBuilder.addRoute("c", "d")
        );
        var infra = infraBuilder.build();
        var runTime = getRoutesRunTime(routes, REALISTIC_FAST_TRAIN);
        var occupancyGraph = ImmutableMultimap.of(
                routes.get(0), new OccupancyBlock(300, 3600, 0, 1),
                routes.get(2), new OccupancyBlock(0, 3600, 0, 1)
        );
        double timeStep = 2;
        var res = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 0)),
                Set.of(new Pathfinding.EdgeLocation<>(routes.get(2), 100)),
                occupancyGraph,
                timeStep,
                POSITIVE_INFINITY,
                runTime + 60, // We add a margin for the stop time
                Set.of()
        );

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
    }

    /** Returns the time it takes to reach the end of the last routes,
     * starting at speed 0 at the start of the first route*/
    private double getRoutesRunTime(List<SignalingRoute> routes, RollingStock rollingStock) {
        double time = 0;
        double speed = 0;
        for (var route : routes) {
            var envelope = STDCMUtils.simulateRoute(route, speed, 0,
                    rollingStock, 2., new double[]{}, Set.of());
            assert envelope != null;
            time += envelope.getTotalTime();
            speed = envelope.getEndSpeed();
        }
        return time;
    }

    /** Checks that the result don't cross in an occupied section */
    private void occupancyTest(STDCMResult res, ImmutableMultimap<SignalingRoute, OccupancyBlock> occupancyGraph) {
        var routes = res.trainPath().routePath();
        for (var index = 0; index < routes.size(); index++) {
            var startRoutePosition = routes.get(index).pathOffset();
            var routeOccupancies = occupancyGraph.get(routes.get(index).element());
            for (var occupancy : routeOccupancies) {
                var enterTime = res.departureTime() + res.envelope().interpolateTotalTimeClamp(
                        startRoutePosition + occupancy.distanceStart()
                );
                var exitTime = res.departureTime() + res.envelope().interpolateTotalTimeClamp(
                        startRoutePosition + occupancy.distanceEnd()
                );
                assertTrue(enterTime >= occupancy.timeEnd() || exitTime <= occupancy.timeStart());
            }
        }
    }
}
