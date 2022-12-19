package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.graph.STDCMSimulations;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.Set;
import java.util.stream.Collectors;

public class DepartureTimeShiftTests {

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

        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)))
                .run();
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

        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)))
                .run();

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

        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1000)))
                .run();

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

        var occupancyGraph = ImmutableMultimap.of(delayedRoute, new OccupancyBlock(
                0,
                10000,
                0,
                50)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1000)))
                .setUnavailableTimes(occupancyGraph)
                .run();

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
        var firstRouteEnvelope = STDCMSimulations.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2, new double[]{}, null);
        assert firstRouteEnvelope != null;
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(
                        firstRouteEnvelope.getTotalTime() + 10,
                        POSITIVE_INFINITY,
                        0, 100),
                secondRoute, new OccupancyBlock(0, 3600, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 100)))
                .setUnavailableTimes(occupancyGraph)
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdRoute, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();

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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();

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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();

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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthRoute, 1)))
                .setUnavailableTimes(occupancyGraph)
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthRoute, 1)))
                .setUnavailableTimes(occupancyGraph)
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdRoute, 1)))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        occupancyTest(res, occupancyGraph);
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
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(0, 1000, 0, 100)
        );
        var res1 = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 0)))
                .setUnavailableTimes(occupancyGraph)
                .setMaxDepartureDelay(1001)
                .run();
        assertNotNull(res1);

        var res2 = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 0)))
                .setUnavailableTimes(occupancyGraph)
                .setMaxDepartureDelay(999)
                .run();
        assertNull(res2);
    }
}
