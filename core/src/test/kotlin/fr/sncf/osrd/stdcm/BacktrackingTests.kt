package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.stdcm.graph.simulateRoute
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class BacktrackingTests {
    /** This test requires some backtracking to compute the final braking curve.
     * With a naive approach we reach the destination in time, but the extra braking curve makes us
     * reach the next block  */
    @Test
    fun testBacktrackingBrakingCurve() {
        /*
        a ------> b
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val route = infraBuilder.addRoute("a", "b", 1000.0)
        val firstRouteEnvelope = simulateRoute(
            route, 0.0, 0.0,
            TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val runTime = firstRouteEnvelope.totalTime
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            route, OccupancyBlock(runTime + 1, Double.POSITIVE_INFINITY, 0.0, 1000.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(route, 0.0)))
            .setEndLocations(setOf(EdgeLocation(route, 1000.0)))
            .setUnavailableTimes(occupancyGraph)
            .run() ?: return
        STDCMHelpers.occupancyTest(res, occupancyGraph)
    }

    /** This is the same test as the one above, but with the braking curve spanning over several routes  */
    @Test
    fun testBacktrackingBrakingCurveSeveralRoutes() {
        /*
        a ------> b -> c -> d -> e
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0)
        infraBuilder.addRoute("b", "c", 10.0)
        infraBuilder.addRoute("c", "d", 10.0)
        val lastRoute = infraBuilder.addRoute("d", "e", 10.0)
        val firstRouteEnvelope = simulateRoute(
            firstRoute, 0.0, 0.0,
            TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val runTime = firstRouteEnvelope.totalTime
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            lastRoute, OccupancyBlock(runTime + 10, Double.POSITIVE_INFINITY, 0.0, 10.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(
                setOf(
                    EdgeLocation(
                        firstRoute,
                        0.0
                    )
                )
            )
            .setEndLocations(setOf(EdgeLocation(lastRoute, 5.0)))
            .setUnavailableTimes(occupancyGraph)
            .run() ?: return
        STDCMHelpers.occupancyTest(res, occupancyGraph)
    }

    /** Test that we don't stay in the first route for too long when there is an MRSP drop at the route transition  */
    @Test
    fun testBacktrackingMRSPDrop() {
        /*
        a ------> b -> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 100.0, 5.0)
        val firstRouteEnvelope = simulateRoute(
            firstRoute, 0.0, 0.0,
            TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val runTime = firstRouteEnvelope.totalTime
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(runTime + 10, Double.POSITIVE_INFINITY, 0.0, 1000.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(
                setOf(
                    EdgeLocation(
                        firstRoute,
                        0.0
                    )
                )
            )
            .setEndLocations(setOf(EdgeLocation(secondRoute, 5.0)))
            .setUnavailableTimes(occupancyGraph)
            .run() ?: return
        STDCMHelpers.occupancyTest(res, occupancyGraph)
    }

    /** Test that we can backtrack several times over the same edges  */
    @Test
    fun testManyBacktracking() {
        /*
        a ------> b -> c -> d -> e ----> f

        Long first route for speedup, then the MRSP drops at each (short) route
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 10000.0)
        infraBuilder.addRoute("b", "c", 10.0, 20.0)
        infraBuilder.addRoute("c", "d", 10.0, 15.0)
        infraBuilder.addRoute("d", "e", 10.0, 10.0)
        val lastRoute = infraBuilder.addRoute("e", "f", 1000.0, 5.0)
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(
                setOf(
                    EdgeLocation(
                        firstRoute,
                        0.0
                    )
                )
            )
            .setEndLocations(
                setOf(
                    EdgeLocation(
                        lastRoute,
                        1000.0
                    )
                )
            )
            .run()!!
        Assertions.assertTrue(res.envelope.continuous)
    }
}
