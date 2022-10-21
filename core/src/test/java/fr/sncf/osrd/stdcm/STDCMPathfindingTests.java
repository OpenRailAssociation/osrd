package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.*;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.*;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.STDCMGraph;
import fr.sncf.osrd.api.stdcm.STDCMPathfinding;
import fr.sncf.osrd.api.stdcm.STDCMResult;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
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
                2.
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
                2.
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
                2.
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
                2.
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
                2.
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
                2.
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
                2.
        );
        var res2 = STDCMPathfinding.findPath(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)),
                occupancyGraph2,
                2.
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
                2.
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
                2.
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
                2.
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
                2.
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
                2.
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
        var firstRouteEnvelope = STDCMGraph.simulateRoute(firstRoute, 0, 0, REALISTIC_FAST_TRAIN, 2);
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
                2.
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
                2.
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
                2.
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
                2.
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
                2.
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
                2.
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
                2.
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
                2.
        );
        assertNull(res);
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
