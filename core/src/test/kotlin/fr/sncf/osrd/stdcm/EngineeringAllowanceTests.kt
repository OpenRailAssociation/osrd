package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.stdcm.STDCMHelpers.getRoutesRunTime
import fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest
import fr.sncf.osrd.stdcm.graph.simulateRoute
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class EngineeringAllowanceTests {
    /** Test that we can add an engineering allowance to avoid an occupied section  */
    @Test
    fun testSlowdown() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0, 30.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 10000.0, 30.0)
        val thirdRoute = infraBuilder.addRoute("c", "d", 100.0, 30.0)
        val firstRouteEnvelope = simulateRoute(
            firstRoute, 0.0, 0.0,
            TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val secondRouteEnvelope = simulateRoute(
            secondRoute, firstRouteEnvelope.endSpeed,
            0.0, TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val timeThirdRouteFree = firstRouteEnvelope.totalTime + secondRouteEnvelope.totalTime
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(firstRouteEnvelope.totalTime + 10, Double.POSITIVE_INFINITY, 0.0, 1000.0),
            thirdRoute, OccupancyBlock(0.0, timeThirdRouteFree + 30, 0.0, 100.0)
        )
        val timeStep = 2.0
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(thirdRoute, 1.0)))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
    }

    /** Test that we can add an engineering allowance over several routes to avoid an occupied section  */
    @Test
    fun testSlowdownSeveralRoutes() {
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
        val timeStep = 2.0
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0, 20.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 1000.0, 20.0)
        infraBuilder.addRoute("c", "d", 1000.0, 20.0)
        infraBuilder.addRoute("d", "e", 1000.0, 20.0)
        val lastRoute = infraBuilder.addRoute("e", "f", 1000.0, 20.0)
        val firstRouteEnvelope = simulateRoute(
            firstRoute, 0.0, 0.0,
            TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val secondRouteEnvelope = simulateRoute(
            secondRoute, firstRouteEnvelope.endSpeed,
            0.0, TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val timeLastRouteFree = firstRouteEnvelope.totalTime + 120 + secondRouteEnvelope.totalTime * 3
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(
                firstRouteEnvelope.totalTime + timeStep,
                Double.POSITIVE_INFINITY, 0.0, 1000.0
            ),
            lastRoute, OccupancyBlock(0.0, timeLastRouteFree, 0.0, 1000.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 1000.0)))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
        Assertions.assertEquals(0.0, res.departureTime, 2 * timeStep)
    }

    /** Test that allowances don't cause new conflicts  */
    @Test
    fun testSlowdownWithConflicts() {
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
        val timeStep = 2.0
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0, 20.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 1000.0, 20.0)
        val thirdRoute = infraBuilder.addRoute("c", "d", 1000.0, 20.0)
        infraBuilder.addRoute("d", "e", 1000.0, 20.0)
        val lastRoute = infraBuilder.addRoute("e", "f", 1000.0, 20.0)
        val firstRouteEnvelope = simulateRoute(
            firstRoute, 0.0, 0.0,
            TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val secondRouteEnvelope = simulateRoute(
            secondRoute, firstRouteEnvelope.endSpeed,
            0.0, TestTrains.REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2.0, null, null
        )!!
        val timeLastRouteFree = firstRouteEnvelope.totalTime + 120 + secondRouteEnvelope.totalTime * 3
        val timeThirdRouteOccupied = firstRouteEnvelope.totalTime + 5 + secondRouteEnvelope.totalTime * 2
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(
                firstRouteEnvelope.totalTime + timeStep,
                Double.POSITIVE_INFINITY, 0.0, 1000.0
            ),
            lastRoute, OccupancyBlock(0.0, timeLastRouteFree, 0.0, 1000.0),
            thirdRoute, OccupancyBlock(timeThirdRouteOccupied, Double.POSITIVE_INFINITY, 0.0, 1000.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(lastRoute, 1000.0)))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
        Assertions.assertEquals(0.0, res.departureTime, 2 * timeStep)
    }

    /** Test that we can add the max delay by shifting the departure time, then add more delay by slowing down  */
    @Test
    fun testMaxDepartureTimeShift() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0, 30.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 1000.0, 30.0)
        val thirdRoute = infraBuilder.addRoute("c", "d", 1.0, 30.0)
        val lastRouteEntryTime = getRoutesRunTime(listOf(firstRoute, secondRoute))
        val timeThirdRouteFree = lastRouteEntryTime + 3600 * 2 + 60
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            thirdRoute, OccupancyBlock(0.0, timeThirdRouteFree, 0.0, 1.0)
        )
        val timeStep = 2.0
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(thirdRoute, 1.0)))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .run()!!
        occupancyTest(res, occupancyGraph)
        Assertions.assertEquals((3600 * 2).toDouble(), res.departureTime, 2 * timeStep)
        Assertions.assertTrue(res.departureTime <= 3600 * 2)
    }

    /** The allowance happens in an area where we have added delay by shifting the departure time  */
    @Test
    fun testAllowanceWithDepartureTimeShift() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 2000.0, 20.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 2000.0, 20.0)
        val thirdRoute = infraBuilder.addRoute("c", "d", 2000.0, 20.0)
        val forthRoute = infraBuilder.addRoute("d", "e", 2000.0, 20.0)
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            firstRoute, OccupancyBlock(0.0, 600.0, 0.0, 100.0),
            firstRoute, OccupancyBlock(2000.0, Double.POSITIVE_INFINITY, 0.0, 100.0),
            secondRoute, OccupancyBlock(0.0, 1200.0, 0.0, 100.0),
            thirdRoute, OccupancyBlock(0.0, 1800.0, 0.0, 100.0),
            forthRoute, OccupancyBlock(0.0, 4000.0, 0.0, 100.0)
        )
        val timeStep = 2.0
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(firstRoute, 0.0)))
            .setEndLocations(setOf(EdgeLocation(forthRoute, 1.0)))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
    }

    /** Test that we return null with no crash when we can't slow down fast enough  */
    @Test
    fun testImpossibleEngineeringAllowance() {
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
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1000.0),
            infraBuilder.addRoute("b", "c", 1.0),
            infraBuilder.addRoute("c", "d", 1000.0)
        )
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            routes[0], OccupancyBlock(300.0, Double.POSITIVE_INFINITY, 0.0, 1000.0),
            routes[2], OccupancyBlock(0.0, 3600.0, 0.0, 1000.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
            .setEndLocations(setOf(EdgeLocation(routes[2], 1000.0)))
            .setUnavailableTimes(occupancyGraph)
            .setMaxDepartureDelay(Double.POSITIVE_INFINITY)
            .run()
        Assertions.assertNull(res)
    }

    /** Test that we return the fastest path even if there are some engineering allowances */
    @Test
    fun testReturnTheFastestPathWithAllowance() {
        /*
        a --> b --> c --> d

        space
          ^
        d |#####################  /  end
          |##################### /   /
        c |#####################/   /
          |    ________________/   /
        b |   /                   /
          |  /################## /
        a |_/_##################/____> time
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b"),
            infraBuilder.addRoute("b", "c"),
            infraBuilder.addRoute("c", "d")
        )
        val infra = infraBuilder.build()
        val occupancyGraph = ImmutableMultimap.of(
            routes[0], OccupancyBlock(300.0, 3600.0, 0.0, 1.0),
            routes[2], OccupancyBlock(0.0, 3600.0, 0.0, 1.0)
        )
        val timeStep = 2.0
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartLocations(setOf(EdgeLocation(routes[0], 0.0)))
            .setEndLocations(setOf(EdgeLocation(routes[2], 100.0)))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .run()!!
        occupancyTest(res, occupancyGraph)
        Assertions.assertEquals(3600.0, res.departureTime, timeStep)
    }
}
