package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import com.google.common.collect.Range
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.stdcm.STDCMHelpers.getRoutesRunTime
import fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class STDCMPathfindingTests {
    /** Look for a path in an empty timetable  */
    @Test
    fun emptyTimetable() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 50.0)))
            .run()!!
    }

    /** Look for a path where the routes are occupied before and after  */
    @Test
    fun betweenTrains() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(0.0, 50.0, 0.0, 100.0),
            firstRoute, OccupancyBlock(10000.0, Double.POSITIVE_INFINITY, 0.0, 100.0),
            secondRoute, OccupancyBlock(0.0, 50.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(10000.0, Double.POSITIVE_INFINITY, 0.0, 100.0)
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

    /** Test that no path is found when the routes aren't connected  */
    @Test
    fun disconnectedRoutes() {
        /*
        a --> b

        x --> y
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("x", "y")
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 0.0)))
            .run()
        Assertions.assertNull(res)
    }

    /** Test that no path is found if the first route is free for a very short interval  */
    @Test
    fun impossiblePath() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(0.0, 99.0, 0.0, 100.0),
            firstRoute, OccupancyBlock(101.0, Double.POSITIVE_INFINITY, 0.0, 100.0),
            secondRoute, OccupancyBlock(0.0, 50.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(1000.0, Double.POSITIVE_INFINITY, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 50.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()
        Assertions.assertNull(res)
    }

    /** Test that we can find a path even if the last route is occupied when the train starts  */
    @Test
    fun lastRouteOccupiedAtStart() {
        /*
        a ------> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0)
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            secondRoute, OccupancyBlock(0.0, 10.0, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 50.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** Test that the path can change depending on the occupancy  */
    @Test
    fun testAvoidBlockedRoutes() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        infraBuilder.addRoute("a", "b")
        val routeTop = infraBuilder.addRoute("b", "c1")
        val routeBottom = infraBuilder.addRoute("b", "c2")
        infraBuilder.addRoute("c1", "d")
        infraBuilder.addRoute("c2", "d")
        infraBuilder.addRoute("d", "e")
        val infra = infraBuilder.build()
        val occupancyGraph1 = ImmutableMultimap.of(
            routeTop, OccupancyBlock(0.0, Double.POSITIVE_INFINITY, 0.0, 100.0)
        )
        val occupancyGraph2 = ImmutableMultimap.of(
            routeBottom, OccupancyBlock(0.0, Double.POSITIVE_INFINITY, 0.0, 100.0)
        )
        val firstRoute = infra.findSignalingRoute("a->b", "BAL3")
        val lastRoute = infra.findSignalingRoute("d->e", "BAL3")
        val res1 = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 50.0)))
            .setUnavailableTimes(occupancyGraph1)
            .run()!!
        val res2 = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 50.0)))
            .setUnavailableTimes(occupancyGraph2)
            .run()!!
        val routes1 = res1.routes.ranges.stream()
            .map { route: EdgeRange<SignalingRoute?> -> route.edge!!.infraRoute.id }.toList()
        val routes2 = res2.routes.ranges.stream()
            .map { route: EdgeRange<SignalingRoute?> -> route.edge!!.infraRoute.id }.toList()
        Assertions.assertFalse(routes1.contains("b->c1"))
        Assertions.assertTrue(routes1.contains("b->c2"))
        occupancyTest(res1, occupancyGraph1)
        Assertions.assertFalse(routes2.contains("b->c2"))
        Assertions.assertTrue(routes2.contains("b->c1"))
        occupancyTest(res2, occupancyGraph2)
    }

    /** Test that everything works well when the train is at max speed during route transitions  */
    @Test
    fun veryLongPathTest() {
        /*
        a ------> b -----> c ------> d
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 10000.0)
        infraBuilder.addRoute("b", "c", 10000.0)
        val lastRoute = infraBuilder.addRoute("c", "d", 10000.0)
        val infra = infraBuilder.build()
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 9000.0)))
            .run()!!
    }

    /** Test that we avoid a path that the train can't use because of a high slope  */
    @Test
    fun testAvoidImpossiblePath() {
        /*
                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        val infraBuilder = DummyRouteGraphBuilder()
        infraBuilder.addRoute("a", "b")
        infraBuilder.addRoute("b", "c1")
        infraBuilder.addRoute("b", "c2")
        val routeTop = infraBuilder.addRoute("c1", "d")
        infraBuilder.addRoute("c2", "d")
        infraBuilder.addRoute("d", "e")
        val infra = infraBuilder.build()
        val track = routeTop.infraRoute.trackRanges[0].track.edge
        track.gradients[Direction.FORWARD] = TreeRangeMap.create()
        track.gradients[Direction.FORWARD]!!
            .put(Range.closed(0.0, track.length), 1000.0)
        val firstRoute = infra.findSignalingRoute("a->b", "BAL3")
        val lastRoute = infra.findSignalingRoute("d->e", "BAL3")
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 50.0)))
            .run()!!
    }

    /** Test that we don't enter infinite loops  */
    @Test
    fun testImpossiblePathWithLoop() {
        /*
        a --> b
        ^----/

        x --> y
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstLoop = infraBuilder.addRoute("a", "b")
        infraBuilder.addRoute("b", "a")
        val disconnectedRoute = infraBuilder.addRoute("x", "y")
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstLoop, 0.0)))
            .setEndLocations(setOf(EdgeLocation(disconnectedRoute, 0.0)))
            .run()
        Assertions.assertNull(res)
    }

    /** Test that we check that the total run time doesn't exceed the threshold if it happens after the edge start  */
    @Test
    fun testTotalRunTimeLongEdge() {
        /*
        a ---------> b
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val route = infraBuilder.addRoute("a", "b", 10000.0)
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(route, 0.0)))
            .setEndLocations(setOf(EdgeLocation(route, 10000.0)))
            .setMaxRunTime(100.0)
            .run()
        Assertions.assertNull(res)
    }

    /** Test that we check that the total run time doesn't exceed the threshold with many small edges  */
    @Test
    fun testTotalRunTimeShortEdges() {
        /*
        1 --> 2 --> ... --> 10
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = ArrayList<SignalingRoute>()
        for (i in 0..9) routes.add(infraBuilder.addRoute((i + 1).toString(), (i + 2).toString(), 1000.0))
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
            .setEndLocations(setOf(EdgeLocation(routes[9], 1000.0)))
            .setMaxRunTime(100.0)
            .run()
        Assertions.assertNull(res)
    }

    /** Test that the start delay isn't included in the total run time  */
    @Test
    fun testMaxRunTimeWithDelay() {
        /*
        a --> b
         */
        val timeStep = 2.0
        val infraBuilder = DummyRouteGraphBuilder()
        val route = infraBuilder.addRoute("a", "b")
        val infra = infraBuilder.build()
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(route, 0.0)))
            .setEndLocations(setOf(EdgeLocation(route, 100.0)))
            .setUnavailableTimes(
                ImmutableMultimap.of(
                    route, OccupancyBlock(0.0, 1000.0, 0.0, 100.0)
                )
            )
            .setMaxDepartureDelay(1000 + timeStep)
            .setMaxRunTime(100.0)
            .setTimeStep(timeStep)
            .run()!!
    }

    /** Test that we ignore occupancy that happen after the end goal  */
    @Test
    fun testOccupancyEnvelopeLengthBlockSize() {
        /*
        a -(start) -> (end) ---------------[occupied]---------> b

        The route is occupied after the destination
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val route = infraBuilder.addRoute("a", "b", 100000.0)
        val infra = infraBuilder.build()
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(route, 0.0)))
            .setEndLocations(setOf(EdgeLocation(route, 10.0)))
            .setUnavailableTimes(
                ImmutableMultimap.of(
                    route, OccupancyBlock(0.0, Double.POSITIVE_INFINITY, 99000.0, 100000.0)
                )
            )
            .run()!!
    }

    /** Test that we don't use the full route envelope when the destination is close to the start  */
    @Test
    fun testOccupancyEnvelopeLength() {
        /*
        a -(start) -> (end) ------------------------> b

        The destination is reached early and the route is occupied after a while
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val route = infraBuilder.addRoute("a", "b", 100000.0)
        val infra = infraBuilder.build()
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(route, 0.0)))
            .setEndLocations(setOf(EdgeLocation(route, 10.0)))
            .setUnavailableTimes(
                ImmutableMultimap.of(
                    route, OccupancyBlock(300.0, Double.POSITIVE_INFINITY, 0.0, 100000.0)
                )
            )
            .run()!!
    }

    /** Test that we can visit the same "opening" several times at very different times  */
    @Test
    fun testVisitSameOpeningDifferentTimes() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b"),
            infraBuilder.addRoute("b", "c"),
            infraBuilder.addRoute("c", "d")
        )
        val infra = infraBuilder.build()
        val runTime = getRoutesRunTime(routes)
        val occupancyGraph = ImmutableMultimap.of(
            routes[0], OccupancyBlock(300.0, 3600.0, 0.0, 1.0),
            routes[2], OccupancyBlock(0.0, 3600.0, 0.0, 1.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
            .setEndLocations(setOf(EdgeLocation(routes[2], 100.0)))
            .setUnavailableTimes(occupancyGraph)
            .setMaxRunTime(runTime + 60) // We add a margin for the stop time
            .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we return the earliest path among the fastest ones */
    @Test
    fun testReturnTheEarliestOfTheFastestPaths() {
        /*
        a --> b

        space
          ^     end     end
          |    /       /
        b |   /       /
          |  / ##### /  
        a |_/_ #####/________> time
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(infraBuilder.addRoute("a", "b"))
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            routes[0], OccupancyBlock(300.0, 3600.0, 0.0, 1.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
            .setEndLocations(setOf(EdgeLocation(routes[0], 100.0)))
            .setUnavailableTimes(occupancyGraph)
            .run()!!
        occupancyTest(res, occupancyGraph)
        Assertions.assertTrue(res.departureTime < 300)
    }
}
