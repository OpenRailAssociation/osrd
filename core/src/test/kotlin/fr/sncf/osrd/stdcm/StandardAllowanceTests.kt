package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class StandardAllowanceTests {
    /** Contains result with and without allowance, with the method above it makes testing easier  */
    @JvmRecord
    data class STDCMAllowanceResults(@JvmField val withAllowance: STDCMResult, @JvmField val withoutAllowance: STDCMResult)

    /** Test that the path found with a simple allowance is longer than the path we find with no allowance  */
    @Test
    fun testSimpleStandardAllowance() {
        /*
        a --> b --> c --> d
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1000.0, 30.0),
            infraBuilder.addRoute("b", "c", 1000.0, 30.0),
            infraBuilder.addRoute("c", "d", 1000.0, 30.0)
        )
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.Percentage(10.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
                .setEndLocations(setOf(EdgeLocation(routes[2], 1000.0)))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withAllowance)
        Assertions.assertNotNull(res.withoutAllowance)
        checkAllowanceResult(res, allowance)
    }

    /** Same test as the previous one, with a very high allowance value (1000%)  */
    @Test
    fun testVeryHighStandardAllowance() {
        /*
        a --> b --> c --> d
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1000.0, 30.0),
            infraBuilder.addRoute("b", "c", 1000.0, 30.0),
            infraBuilder.addRoute("c", "d", 1000.0, 30.0)
        )
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.Percentage(1000.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
                .setEndLocations(setOf(EdgeLocation(routes[2], 1000.0)))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withAllowance)
        Assertions.assertNotNull(res.withoutAllowance)
        checkAllowanceResult(res, allowance)
    }

    /** Test that we can add delays to avoid occupied sections with a standard allowance  */
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
        val allowance = AllowanceValue.Percentage(20.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
                .setEndLocations(setOf(EdgeLocation(secondRoute, 50.0)))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)
        val secondRouteEntryTime = (res.withAllowance.departureTime
                + res.withAllowance.envelope.interpolateTotalTime(firstRoute.infraRoute.length))
        Assertions.assertTrue(secondRouteEntryTime >= 3600 - timeStep)
        occupancyTest(res.withAllowance, occupancyGraph, timeStep)
        checkAllowanceResult(res, allowance)
    }

    /** Test that we can add delays on partial route ranges with a standard allowance  */
    @Test
    fun testRouteRangeOccupancy() {
        /*
        a ------> b

        The route is occupied from a certain point only, we check that we don't add too little or too much delay
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val route = infraBuilder.addRoute("a", "b", 10000.0)
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            route, OccupancyBlock(0.0, 3600.0, 5000.0, 10000.0)
        )
        val allowance = AllowanceValue.Percentage(20.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(setOf(EdgeLocation(route, 0.0)))
                .setEndLocations(setOf(EdgeLocation(route, 10000.0)))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)
        val timeEnterOccupiedSection = (res.withAllowance.departureTime
                + res.withAllowance.envelope.interpolateTotalTime(5000.0))
        Assertions.assertEquals(3600.0, timeEnterOccupiedSection, 2 * timeStep)
        occupancyTest(res.withAllowance, occupancyGraph, 2 * timeStep)
        checkAllowanceResult(res, allowance)
    }

    /** Test that we can have both an engineering and a standard allowance  */
    @Test
    fun testEngineeringWithStandardAllowance() {
        /*
        a --> b -----> c --> d

        space
          ^
        d |############### end
          |############### /
          |###############/
        c |           ___/
          |       ___/
        b |   ___/
          |  /#################
        a |_/##################_> time

         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1000.0, 30.0),
            infraBuilder.addRoute("b", "c", 10000.0, 30.0),
            infraBuilder.addRoute("c", "d", 1000.0, 30.0)
        )
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            routes[0], OccupancyBlock(120.0, Double.POSITIVE_INFINITY, 0.0, 1000.0),
            routes[2], OccupancyBlock(0.0, 1000.0, 0.0, 1000.0)
        )
        val allowance = AllowanceValue.Percentage(20.0)
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
            .setEndLocations(setOf(EdgeLocation(routes[2], 1000.0)))
            .setStandardAllowance(allowance)
            .run()!!
        occupancyTest(res, occupancyGraph, timeStep)
        val thirdRouteEntryTime = (res.departureTime
                + res.envelope.interpolateTotalTime(11000.0))
        Assertions.assertEquals(1000.0, thirdRouteEntryTime, 4 * timeStep) // Errors build up, we need a high delta
    }

    /** Same test as the previous one, with very short routes at the start and end  */
    @Test
    fun testEngineeringWithStandardAllowanceSmallRoutes() {
        /*
        a -> b -----> c -> d

        space
          ^
        d |###############
          |############### end
        c |           ___/
          |       ___/
        b |   ___/
          |  /
        a |_/##################_> time

         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1.0, 30.0),
            infraBuilder.addRoute("b", "c", 10000.0, 30.0),
            infraBuilder.addRoute("c", "d", 1.0, 30.0)
        )
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            routes[0], OccupancyBlock(60.0, Double.POSITIVE_INFINITY, 0.0, 1.0),
            routes[2], OccupancyBlock(0.0, 1000.0, 0.0, 1.0)
        )
        val allowance = AllowanceValue.Percentage(20.0)
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
            .setEndLocations(setOf(EdgeLocation(routes[2], 0.1)))
            .setStandardAllowance(allowance)
            .run()!!
        occupancyTest(res, occupancyGraph, timeStep)
        val thirdRouteEntryTime = (res.departureTime
                + res.envelope.interpolateTotalTime(10001.0))
        Assertions.assertEquals(1000.0, thirdRouteEntryTime, 2 * timeStep)
    }

    /** This test checks that we add the right delay while backtracking several times, by adding mrsp drops  */
    @Test
    fun testManyMRSPDrops() {
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = ArrayList<SignalingRoute>()
        for (i in 0..9) {
            routes.add(
                infraBuilder.addRoute(
                    i.toString(), String.format("%d.5", i),
                    1000.0,
                    50.0
                )
            )
            routes.add(
                infraBuilder.addRoute(
                    String.format("%d.5", i),
                    (i + 1).toString(),
                    10.0,
                    5.0
                )
            )
        }
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.Percentage(50.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
                .setEndLocations(setOf(EdgeLocation(routes[routes.size - 1], 0.0)))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withAllowance)
        Assertions.assertNotNull(res.withoutAllowance)
        checkAllowanceResult(res, allowance)
    }

    /** We shift de departure time a little more at each route  */
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
        c |############# /    /         /
          |#############/____/_________/______________
        b |#####  /    /    /         /
          |#####/     /    /         /
        a start______/____/_________/__________________> time

         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val thirdRoute = infraBuilder.addRoute("c", "d")
        val forthRoute = infraBuilder.addRoute("d", "e")
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.Percentage(100.0)
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(0.0, 200.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(0.0, 600.0, 0.0, 100.0),
            thirdRoute, OccupancyBlock(0.0, 1200.0, 0.0, 100.0),
            forthRoute, OccupancyBlock(0.0, 2000.0, 0.0, 100.0)
        )
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
                .setEndLocations(setOf(EdgeLocation(forthRoute, 1.0)))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)
        occupancyTest(res.withAllowance, occupancyGraph, timeStep)
        checkAllowanceResult(res, allowance)
    }

    /** Test that we can have both an engineering and a standard allowance, with a time per distance allowance  */
    @Test
    fun testEngineeringWithStandardAllowanceTimePerDistance() {
        /*
        a --> b -----> c --> d

        space
          ^
        d |############### end
          |############### /
          |###############/
        c |           ___/
          |       ___/
        b |   ___/
          |  /#################
        a |_/##################_> time

         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1000.0, 30.0),
            infraBuilder.addRoute("b", "c", 10000.0, 30.0),
            infraBuilder.addRoute("c", "d", 1000.0, 30.0)
        )
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            routes[0], OccupancyBlock(120.0, Double.POSITIVE_INFINITY, 0.0, 1000.0),
            routes[2], OccupancyBlock(0.0, 1000.0, 0.0, 1000.0)
        )
        val allowance = AllowanceValue.TimePerDistance(60.0)
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
            .setEndLocations(setOf(EdgeLocation(routes[2], 1000.0)))
            .setStandardAllowance(allowance)
            .run()!!
        occupancyTest(res, occupancyGraph, timeStep)
        val thirdRouteEntryTime = (res.departureTime
                + res.envelope.interpolateTotalTime(11000.0))
        Assertions.assertEquals(1000.0, thirdRouteEntryTime, 2 * timeStep)
    }

    /** Tests a simple path with no conflict, with a time per distance allowance and very low value  */
    @Test
    fun testSimplePathTimePerDistanceAllowanceLowValue() {
        /*
        a --> b --> c --> d --> e
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        infraBuilder.addRoute("b", "c")
        infraBuilder.addRoute("c", "d")
        val forthRoute = infraBuilder.addRoute("d", "e")
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.TimePerDistance(1.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
                .setEndLocations(setOf(EdgeLocation(forthRoute, 100.0)))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * timeStep)
    }

    /** Tests a simple path with no conflict, with a time per distance allowance  */
    @Test
    fun testSimplePathTimePerDistanceAllowance() {
        /*
        a --> b --> c --> d --> e
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        infraBuilder.addRoute("b", "c")
        infraBuilder.addRoute("c", "d")
        val forthRoute = infraBuilder.addRoute("d", "e")
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.TimePerDistance(15.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
                .setEndLocations(setOf(EdgeLocation(forthRoute, 100.0)))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * timeStep)
    }

    /** We shift de departure time a little more at each route, with a time per distance allowance  */
    @Test
    fun testMaximumShiftWithDelaysTimePerDistance() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        e |################################ end
          |################################/__________
        d |#################### /         /
          |####################/_________/____________
        c |############# /    /         /
          |#############/____/_________/______________
        b |#####  /    /    /         /
          |#####/     /    /         /
        a start______/____/_________/__________________> time

         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val thirdRoute = infraBuilder.addRoute("c", "d")
        val forthRoute = infraBuilder.addRoute("d", "e")
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.TimePerDistance(15.0)
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(0.0, 200.0, 0.0, 100.0),
            secondRoute, OccupancyBlock(0.0, 600.0, 0.0, 100.0),
            thirdRoute, OccupancyBlock(0.0, 1200.0, 0.0, 100.0),
            forthRoute, OccupancyBlock(0.0, 2000.0, 0.0, 100.0)
        )
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
                .setEndLocations(setOf(EdgeLocation(forthRoute, 100.0)))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)
        occupancyTest(res.withAllowance, occupancyGraph, timeStep)

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * timeStep)
    }

    /** The path we find must pass through an (almost) exact space-time point at the middle of the path,
     * we check that we can still do this with mareco  */
    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun testMarecoSingleSpaceTimePoint(isTimePerDistance: Boolean) {
        /*
        a --> b --> c --> d --> e

        space
        d ^
          |           end
        c |########## /
          |##########/
        b |         /#################
          |        / #################
        a |_______/__#################> time

         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0, 30.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 1000.0, 30.0)
        val thirdRoute = infraBuilder.addRoute("c", "d")
        val infra = infraBuilder.build()
        var allowance: AllowanceValue = AllowanceValue.Percentage(100.0)
        if (isTimePerDistance) allowance = AllowanceValue.TimePerDistance(120.0)
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(2000 + timeStep, Double.POSITIVE_INFINITY, 0.0, 1000.0),
            secondRoute, OccupancyBlock(0.0, 2000 - timeStep, 0.0, 1000.0)
        )
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
                .setEndLocations(setOf(EdgeLocation(thirdRoute, 100.0)))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)
        Assertions.assertEquals(0.0, res.withAllowance.envelope.endSpeed)
        Assertions.assertEquals(0.0, res.withoutAllowance.envelope.endSpeed)
        occupancyTest(res.withAllowance, occupancyGraph, 2 * timeStep)

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * timeStep)
    }

    companion object {
        private const val timeStep = 2.0

        /** Runs the pathfinding with the given parameters, with and without allowance  */
        @JvmStatic
        fun runWithAndWithoutAllowance(builder: STDCMPathfindingBuilder): STDCMAllowanceResults {
            builder.setTimeStep(timeStep)
            val resultWithAllowance = builder.run()!!
            builder.setStandardAllowance(null)
            val resultWithoutAllowance = builder.run()!!
            return STDCMAllowanceResults(
                resultWithAllowance,
                resultWithoutAllowance
            )
        }

        private fun checkAllowanceResult(results: STDCMAllowanceResults, value: AllowanceValue) {
            checkAllowanceResult(results, value, Double.NaN)
        }

        /** Compares the run time with and without allowance, checks that the allowance is properly applied  */
        @JvmStatic
        fun checkAllowanceResult(results: STDCMAllowanceResults, value: AllowanceValue, tolerance: Double) {
            var mutTolerance = tolerance
            if (java.lang.Double.isNaN(mutTolerance)) mutTolerance = 2 * timeStep
            val baseEnvelope = results.withoutAllowance.envelope
            val extraTime = value.getAllowanceTime(baseEnvelope.totalTime, baseEnvelope.totalDistance)
            val baseTime = baseEnvelope.totalTime
            val actualTime = results.withAllowance.envelope.totalTime
            Assertions.assertEquals(
                baseTime + extraTime,
                actualTime,
                mutTolerance
            )
        }
    }
}
