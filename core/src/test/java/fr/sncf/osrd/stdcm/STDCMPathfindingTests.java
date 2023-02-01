package fr.sncf.osrd.stdcm;

import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.*;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)))
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 0)))
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNotNull(res);
        assert res.envelope().getTotalTime() >= 1000;
        STDCMHelpers.occupancyTest(res, occupancyGraph);
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

        var res1 = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)))
                .setUnavailableTimes(occupancyGraph1)
                .run();
        var res2 = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)))
                .setUnavailableTimes(occupancyGraph2)
                .run();
        assertNotNull(res1);
        assertNotNull(res2);
        final var routes1 = res1.routes().ranges().stream()
                .map(route -> route.edge().getInfraRoute().getID()).toList();
        final var routes2 = res2.routes().ranges().stream()
                .map(route -> route.edge().getInfraRoute().getID()).toList();

        assertFalse(routes1.contains("b->c1"));
        assertTrue(routes1.contains("b->c2"));
        STDCMHelpers.occupancyTest(res1, occupancyGraph1);

        assertFalse(routes2.contains("b->c2"));
        assertTrue(routes2.contains("b->c1"));
        STDCMHelpers.occupancyTest(res2, occupancyGraph2);
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 9000)))
                .run();
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

        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 50)))
                .run();
        assertNotNull(res);
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstLoop, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(disconnectedRoute, 0)))
                .run();
        assertNull(res);
    }

    /** Test that we check that the total run time doesn't exceed the threshold if it happens after the edge start */
    @Test
    public void testTotalRunTimeLongEdge() {
        /*
        a ---------> b
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var route = infraBuilder.addRoute("a", "b", 10_000);
        var infra = infraBuilder.build();
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 10_000)))
                .setMaxRunTime(100)
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(9), 1_000)))
                .setMaxRunTime(100)
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 100)))
                .setUnavailableTimes(ImmutableMultimap.of(
                        route, new OccupancyBlock(0, 1000, 0, 100)
                ))
                .setMaxDepartureDelay(1000)
                .setMaxRunTime(100)
                .run();
        assertNotNull(res);
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 10)))
                .setUnavailableTimes(ImmutableMultimap.of(
                        route, new OccupancyBlock(0, POSITIVE_INFINITY, 99_000, 100_000)
                ))
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(route, 10)))
                .setUnavailableTimes(ImmutableMultimap.of(
                        route, new OccupancyBlock(300, POSITIVE_INFINITY, 0, 100_000)
                ))
                .run();
        assertNotNull(res);
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
        var runTime = STDCMHelpers.getRoutesRunTime(routes);
        var occupancyGraph = ImmutableMultimap.of(
                routes.get(0), new OccupancyBlock(300, 3600, 0, 1),
                routes.get(2), new OccupancyBlock(0, 3600, 0, 1)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(2), 100)))
                .setUnavailableTimes(occupancyGraph)
                .setMaxRunTime(runTime + 60) // We add a margin for the stop time
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
    }

    /** Test that we return the earliest path among the fastest ones*/
    @Test
    public void testReturnTheEarliestOfTheFastestPaths() {
        /*
        a --> b

        space
          ^     end     end
          |    /       /
        b |   /       /
          |  / ##### /  
        a |_/_ #####/________> time
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var routes = List.of(infraBuilder.addRoute("a", "b"));
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                routes.get(0), new OccupancyBlock(300, 3600, 0, 1)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 100)))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
        assertTrue(res.departureTime() < 300);
    }
  
}
