package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest
import fr.sncf.osrd.stdcm.graph.simulateRoute
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import java.util.stream.Collectors

class DepartureTimeShiftTests {
    /** Test that we can add delays to avoid occupied sections  */
    @Test
    fun testSimpleDelay() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            secondRoute, OccupancyBlock(0.0, 3600.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 50.0)))
            .run()!!
        val secondRouteEntryTime = (res.departureTime
                + res.envelope.interpolateTotalTime(firstRoute.infraRoute.length))
        Assertions.assertTrue(secondRouteEntryTime >= 3600)
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we can add delays to avoid several occupied blocks  */
    @Test
    fun testSimpleSeveralBlocks() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            secondRoute, OccupancyBlock(0.0, 1200.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(1200.0, 2400.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(2400.0, 3600.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 50.0)))
            .run()!!
        val secondRouteEntryTime = (res.departureTime
                + res.envelope.interpolateTotalTime(firstRoute.infraRoute.length))
        Assertions.assertTrue(secondRouteEntryTime >= 3600)
        occupancyTest(res, occupancyGraph)
    }

    /** Test that the path we find is the one with the earliest arrival time rather than the shortest  */
    @Test
    fun testEarliestArrivalTime() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0)
        infraBuilder.addRoute("b", "c1", 50.0, 1.0)
        infraBuilder.addRoute("b", "c2")
        infraBuilder.addRoute("c1", "d", 50.0, 1.0)
        infraBuilder.addRoute("c2", "d")
        val lastRoute = infraBuilder.addRoute("d", "e", 1000.0)
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 1000.0)))
            .run()!!
        val routes = res.routes.ranges.stream()
            .map { edgeRange: EdgeRange<SignalingRoute?> -> edgeRange.edge!!.infraRoute.id }
            .collect(Collectors.toSet())
        Assertions.assertTrue(routes.contains("b->c2"))
        Assertions.assertTrue(routes.contains("c2->d"))
        Assertions.assertFalse(routes.contains("b->c1"))
        Assertions.assertFalse(routes.contains("c1->d"))
    }

    /** Test that the path we find is the one with the earliest arrival time rather than the shortest
     * while taking into account departure time delay caused by the first block occupancy  */
    @Test
    fun testEarliestArrivalTimeWithOccupancy() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0)
        infraBuilder.addRoute("b", "c1")
        val delayedRoute = infraBuilder.addRoute("b", "c2", 50.0)
        infraBuilder.addRoute("c1", "d")
        infraBuilder.addRoute("c2", "d")
        val lastRoute = infraBuilder.addRoute("d", "e", 1000.0)
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            delayedRoute, OccupancyBlock(
                0.0,
                10000.0,
                0.0,
                50.0
            )
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 1000.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()!!
        val routes = res.routes.ranges.stream()
            .map { edgeRange: EdgeRange<SignalingRoute?> -> edgeRange.edge!!.infraRoute.id }
            .collect(Collectors.toSet())
        Assertions.assertTrue(routes.contains("b->c1"))
        Assertions.assertTrue(routes.contains("c1->d"))
        Assertions.assertFalse(routes.contains("b->c2"))
        Assertions.assertFalse(routes.contains("c2->d"))
    }

    /** Test that we don't add too much delay, crossing over occupied sections in previous routes  */
    @Test
    fun testImpossibleAddedDelay() {
        /*
        a --> b --> c --> d
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val firstRouteEnvelope = simulateRoute(
            firstRoute, 0.0, 0.0,
            TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(
                firstRouteEnvelope.totalTime + 10,
                Double.POSITIVE_INFINITY,
                0.0, 100.0
            ),
            secondRoute, OccupancyBlock(0.0, 3600.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 100.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()
        Assertions.assertNull(res)
    }

    /** Test that we can backtrack when the first "opening" doesn't lead to a valid solution.
     * To do this, we need to consider that the same route at different times can be different edges  */
    @Test
    fun testDifferentOpenings() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val thirdRoute = infraBuilder.addRoute("c", "d")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            secondRoute, OccupancyBlock(300.0, 500.0, 0.0, 100.0),
            thirdRoute, OccupancyBlock(0.0, 500.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(thirdRoute, 50.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** This is the same test as the one above, but with the split on the first route.  */
    @Test
    fun testTwoOpeningsFirstRoute() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(300.0, 500.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(0.0, 500.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 50.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** This is the same test as the one above, but with the split on the last route.  */
    @Test
    fun testTwoOpeningsLastRoute() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            secondRoute, OccupancyBlock(300.0, 500.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 50.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we keep track of how much we can shift the departure time over several routes  */
    @Test
    fun testMaximumShiftMoreRestrictive() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        infraBuilder.addRoute("c", "d", 1.0) // Very short to prevent slowdowns
        val forthRoute = infraBuilder.addRoute("d", "e")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(1200.0, Double.POSITIVE_INFINITY, 0.0, 100.0),
            secondRoute, OccupancyBlock(600.0, Double.POSITIVE_INFINITY, 0.0, 100.0),
            forthRoute, OccupancyBlock(0.0, 1000.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(forthRoute, 1.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()
        Assertions.assertNull(res)
    }

    /** We shift de departure time a little more at each route,
     * we test that we still keep track of how much we can shift.
     * This test may need tweaking / removal once we consider slowdowns.  */
    @Test
    fun testMaximumShiftWithDelays() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val thirdRoute = infraBuilder.addRoute("c", "d")
        val forthRoute = infraBuilder.addRoute("d", "e")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(0.0, 200.0, 0.0, 100.0),
            firstRoute, OccupancyBlock(500.0, Double.POSITIVE_INFINITY, 0.0, 100.0),
            secondRoute, OccupancyBlock(0.0, 400.0, 0.0, 100.0),
            thirdRoute, OccupancyBlock(0.0, 600.0, 0.0, 100.0),
            forthRoute, OccupancyBlock(0.0, 800.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(forthRoute, 1.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()
        Assertions.assertNull(res)
    }

    /** Test that we can consider more than two openings  */
    @Test
    fun testSeveralOpenings() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val thirdRoute = infraBuilder.addRoute("c", "d")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            secondRoute, OccupancyBlock(300.0, 600.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(900.0, 1200.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(1500.0, 1800.0, 0.0, 100.0),
            thirdRoute, OccupancyBlock(0.0, 1200.0, 0.0, 100.0),
            thirdRoute, OccupancyBlock(1500.0, Double.POSITIVE_INFINITY, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(thirdRoute, 1.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we don't add more delay than specified  */
    @Test
    fun testMaximumDepartureTimeDelay() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val lastRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(0.0, 1000.0, 0.0, 100.0)
        )
        val timeStep = 2.0
        val res1 = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 0.0)))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .setMaxDepartureDelay(1000 + timeStep)
            .run()!!
        val res2 = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 0.0)))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .setMaxDepartureDelay(1000 - timeStep)
            .run()
        Assertions.assertNull(res2)
    }
}
