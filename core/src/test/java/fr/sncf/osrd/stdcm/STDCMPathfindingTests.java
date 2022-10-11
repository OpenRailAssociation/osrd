package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.*;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.collect.Range;
import com.google.common.collect.TreeRangeMap;
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
                firstRoute, new OccupancyBlock(10000, Double.POSITIVE_INFINITY, 0, 100),
                secondRoute, new OccupancyBlock(0, 50, 0, 100),
                secondRoute, new OccupancyBlock(10000, Double.POSITIVE_INFINITY, 0, 100));
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
        assertTrue(occupancyTest(res,occupancyGraph));
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
                firstRoute, new OccupancyBlock(101, Double.POSITIVE_INFINITY, 0, 100),
                secondRoute, new OccupancyBlock(0, 50, 0, 100),
                secondRoute, new OccupancyBlock(1000, Double.POSITIVE_INFINITY, 0, 100));
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
        assertTrue(occupancyTest(res,occupancyGraph));
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
        assertTrue(occupancyTest(res,occupancyGraph));
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
                routeTop, new OccupancyBlock(0, Double.POSITIVE_INFINITY, 0, 100)
        );
        var occupancyGraph2 = ImmutableMultimap.of(
                routeBottom, new OccupancyBlock(0, Double.POSITIVE_INFINITY, 0, 100)
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
        var routes1 = res1.routes().ranges().stream().map(route -> route.edge().getInfraRoute().getID()).toList();
        var routes2 = res2.routes().ranges().stream().map(route -> route.edge().getInfraRoute().getID()).toList();

        assertFalse(routes1.contains("b->c1"));
        assertTrue(routes1.contains("b->c2"));
        assertTrue(occupancyTest(res1,occupancyGraph1));

        assertFalse(routes2.contains("b->c2"));
        assertTrue(routes2.contains("b->c1"));
        assertTrue(occupancyTest(res2,occupancyGraph2));
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
        assertTrue(occupancyTest(res,occupancyGraph));
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

        assertTrue(occupancyTest(res,occupancyGraph));
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
                                Double.POSITIVE_INFINITY,
                                0, 100),
                        secondRoute, new OccupancyBlock(0, 3600, 0, 100)
                ),
                2.
        );
        assertNull(res);
    }

    private boolean occupancyTest(STDCMResult res, ImmutableMultimap<SignalingRoute,OccupancyBlock> occupancyGraph){
        var routes = res.trainPath().routePath();
        for(var index = 1; index<routes.size(); index++) {
            var endRoutePosition = routes.get(index).pathOffset();
            var startRouteTime = res.departureTime();
            var endRouteTime = res.departureTime() + res.envelope().interpolateTotalTime(endRoutePosition);
            var routeOccupancies = occupancyGraph.get(routes.get(index-1).element());
            for (var occupancy:routeOccupancies){
                if ((occupancy.timeStart()<startRouteTime && startRouteTime<occupancy.timeEnd())
                    ||(occupancy.timeStart()<endRouteTime && endRouteTime<occupancy.timeEnd())){
                    System.out.println("start: "+occupancy.timeStart()+"//"+startRouteTime+"//end: "+occupancy.timeEnd());
                    System.out.println("start: "+occupancy.timeStart()+"//"+endRouteTime+"//end: "+occupancy.timeEnd());
                    return false;
                }
            }
        }
        return true;
    }
}
