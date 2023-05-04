package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest
import fr.sncf.osrd.stdcm.StandardAllowanceTests.Companion.checkAllowanceResult
import fr.sncf.osrd.stdcm.StandardAllowanceTests.Companion.runWithAndWithoutAllowance
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class StopTests {
    /** Look for a path in an empty timetable, with a stop in the middle of a route  */
    @Test
    fun emptyTimetableWithStop() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .addStep(STDCMStep(setOf(EdgeLocation(firstRoute, 0.0)), 0.0, true))
            .addStep(STDCMStep(setOf(EdgeLocation(secondRoute, 50.0)), 10000.0, true))
            .addStep(STDCMStep(setOf(EdgeLocation(secondRoute, 100.0)), 0.0, true))
            .run()!!
        val expectedOffset = 150.0

        // Check that we stop
        Assertions.assertEquals(
            0.0,
            res.envelope.interpolateSpeed(expectedOffset),
            TrainPhysicsIntegrator.SPEED_EPSILON
        )

        // Check that the stop is properly returned
        Assertions.assertEquals(
            listOf(
                TrainStop(expectedOffset, 10000.0)
            ),
            res.stopResults
        )
    }

    /** Look for a path in an empty timetable, with a stop at the start of a route  */
    @Test
    fun emptyTimetableWithStopRouteStart() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .addStep(STDCMStep(setOf(EdgeLocation(firstRoute, 0.0)), 0.0, true))
            .addStep(STDCMStep(setOf(EdgeLocation(secondRoute, 0.0)), 10000.0, true))
            .addStep(STDCMStep(setOf(EdgeLocation(secondRoute, 100.0)), 0.0, true))
            .run()!!
        checkStop(
            res, listOf(
                TrainStop(100.0, 10000.0)
            )
        )
    }

    /** Look for a path in an empty timetable, with a stop at the end of a route  */
    @Test
    fun emptyTimetableWithStopRouteEnd() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .addStep(STDCMStep(setOf(EdgeLocation(firstRoute, 0.0)), 0.0, true))
            .addStep(STDCMStep(setOf(EdgeLocation(firstRoute, 100.0)), 10000.0, true))
            .addStep(STDCMStep(setOf(EdgeLocation(secondRoute, 100.0)), 0.0, true))
            .run()!!
        checkStop(
            res, listOf(
                TrainStop(100.0, 10000.0)
            )
        )
    }

    /** Checks that we can make a detour to pass by an intermediate step  */
    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun detourForStep(stop: Boolean) {
        /*
        a --> b --> c --> d --> e
               \         ^
                \       /
                 \     /
                  \   /
                   v /
                    x
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routesDirectPath = listOf(
            infraBuilder.addRoute("a", "b"),
            infraBuilder.addRoute("b", "c"),
            infraBuilder.addRoute("c", "d"),
            infraBuilder.addRoute("d", "e")
        )
        val detour = listOf(
            infraBuilder.addRoute("b", "x", 100000.0),
            infraBuilder.addRoute("x", "d", 100000.0)
        )
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(100.0)
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            routesDirectPath[0], 0.0
                        )
                    ), 0.0, false
                )
            )
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            detour[1], 1000.0
                        )
                    ), 0.0, stop
                )
            )
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            routesDirectPath[3], 0.0
                        )
                    ), 0.0, true
                )
            )
            .run()!!
        val routes = res.routes.ranges.stream()
            .map { route: EdgeRange<SignalingRoute?> -> route.edge!!.infraRoute.id }.toList()
        Assertions.assertEquals(
            listOf(
                "a->b",
                "b->x",
                "x->d",
                "d->e"
            ), routes
        )
        Assertions.assertNotEquals(stop, res.stopResults.isEmpty())
        Assertions.assertEquals(stop, res.envelope.interpolateSpeed(101100.0) == 0.0)
    }

    /** Test that the stop time is properly accounted for, by making the train stop for too long to find a solution  */
    @Test
    fun testImpossibleSolutionBecauseOfStop() {
        /*
        a --> b --> c
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b")
        val secondRoute = infraBuilder.addRoute("b", "c")
        val infra = infraBuilder.build()
        val unavailableTimes = ImmutableMultimap.of(
            secondRoute, OccupancyBlock(100000.0, Double.POSITIVE_INFINITY, 0.0, 100.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .addStep(STDCMStep(setOf(EdgeLocation(firstRoute, 0.0)), 0.0, true))
            .addStep(STDCMStep(setOf(EdgeLocation(firstRoute, 10.0)), 100000.0, true))
            .addStep(STDCMStep(setOf(EdgeLocation(secondRoute, 100.0)), 0.0, true))
            .setUnavailableTimes(unavailableTimes)
            .run()
        Assertions.assertNull(res)
    }

    /** Checks that we add the right amount of delay with a stop  */
    @Test
    fun delayWithStop() {
        /*
        a --> b --> c -> d
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b"),
            infraBuilder.addRoute("b", "c"),
            infraBuilder.addRoute("c", "d", 1.0)
        )
        val infra = infraBuilder.build()
        val occupancy = ImmutableMultimap.of(
            routes[2], OccupancyBlock(0.0, 12000.0, 0.0, 1.0),
            routes[2], OccupancyBlock(12010.0, Double.POSITIVE_INFINITY, 0.0, 1.0)
        )
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            routes[0], 0.0
                        )
                    ), 0.0, true
                )
            )
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            routes[0], 50.0
                        )
                    ), 10000.0, true
                )
            )
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            routes[2], 1.0
                        )
                    ), 0.0, true
                )
            )
            .setUnavailableTimes(occupancy)
            .run()!!
        checkStop(
            res, listOf(
                TrainStop(50.0, 10000.0)
            )
        )
        occupancyTest(res, occupancy)
    }

    /** Checks that we can handle engineering allowance with a stop  */
    @Test
    fun engineeringAllowanceWithStops() {
        /*
        a --> b --> c --> d

        space
          ^
        e |################### end ###
          |################### /   ###
        d |                   /
          |               __/
        c |    __________/   <-- stop
          |   /
        b |  /
          | /##################
        a |/_##################_> time

         */

        // Note: this test will need to be updated once we can add delay by making stops longer
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1.0, 20.0),
            infraBuilder.addRoute("b", "c", 1000.0, 20.0),
            infraBuilder.addRoute("c", "d", 100.0, 20.0),
            infraBuilder.addRoute("d", "e", 1.0, 20.0)
        )
        val occupancy = ImmutableMultimap.of(
            routes[0], OccupancyBlock(10.0, Double.POSITIVE_INFINITY, 0.0, 1.0),
            routes[3], OccupancyBlock(0.0, 1200.0, 0.0, 1.0),
            routes[3], OccupancyBlock(1220.0, Double.POSITIVE_INFINITY, 0.0, 1.0)
        )
        val timeStep = 2.0
        val infra = infraBuilder.build()
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setUnavailableTimes(occupancy)
            .setTimeStep(timeStep)
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            routes[0], 0.0
                        )
                    ), 0.0, true
                )
            )
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            routes[1], 50.0
                        )
                    ), 1000.0, true
                )
            )
            .addStep(
                STDCMStep(
                    setOf(
                        EdgeLocation(
                            routes[3], 1.0
                        )
                    ), 0.0, true
                )
            )
            .run()!!
        checkStop(
            res, listOf(
                TrainStop(51.0, 1000.0)
            )
        )
        occupancyTest(res, occupancy, 2 * timeStep)
    }

    /** Checks that we can handle a standard allowance with a stop  */
    @Test
    fun standardAllowanceWithStops() {
        /*
        a --> b --> c --> d

        space
          ^
        e |################ end ###
          |################ /   ###
        d |                /
          |               /
        c |    __________/   <-- stop
          |   /
        b |  /
          | /
        a |/____________________> time

         */
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1.0, 20.0),
            infraBuilder.addRoute("b", "c", 1000.0, 20.0),
            infraBuilder.addRoute("c", "d", 100.0, 20.0),
            infraBuilder.addRoute("d", "e", 1.0, 20.0)
        )
        val occupancy = ImmutableMultimap.of(
            routes[3], OccupancyBlock(0.0, 1200.0, 0.0, 1.0),
            routes[3], OccupancyBlock(1220.0, Double.POSITIVE_INFINITY, 0.0, 1.0)
        )
        val timeStep = 2.0
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.Percentage(20.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .setStandardAllowance(allowance)
                .addStep(
                    STDCMStep(
                        setOf(
                            EdgeLocation(
                                routes[0], 0.0
                            )
                        ), 0.0, true
                    )
                )
                .addStep(
                    STDCMStep(
                        setOf(
                            EdgeLocation(
                                routes[1], 50.0
                            )
                        ), 1000.0, true
                    )
                )
                .addStep(
                    STDCMStep(
                        setOf(
                            EdgeLocation(
                                routes[3], 1.0
                            )
                        ), 0.0, true
                    )
                )
        )
        val expectedStops = listOf(
            TrainStop(51.0, 1000.0)
        )
        checkStop(res.withAllowance, expectedStops)
        checkStop(res.withoutAllowance, expectedStops)
        occupancyTest(res.withAllowance, occupancy, 2 * timeStep)
        occupancyTest(res.withoutAllowance, occupancy, 2 * timeStep)
        checkAllowanceResult(res, allowance, 4 * timeStep)
    }

    /** Checks that we can handle both a standard and engineering allowance with a stop  */
    @Test
    fun standardAndEngineeringAllowanceWithStops() {
        /*
        a --> b --> c --> d

        space
          ^
        e |################### end ###
          |################### /   ###
        d |                   /
          |               __/
        c |    __________/   <-- stop
          |   /
        b |  /
          | /##################
        a |/_##################_> time

         */

        // Note: this test will need to be updated once we can add delay by making stops longer
        val infraBuilder = DummyRouteGraphBuilder()
        val routes = listOf(
            infraBuilder.addRoute("a", "b", 1.0, 20.0),
            infraBuilder.addRoute("b", "c", 1000.0, 20.0),
            infraBuilder.addRoute("c", "d", 100.0, 20.0),
            infraBuilder.addRoute("d", "e", 1.0, 20.0)
        )
        val occupancy = ImmutableMultimap.of(
            routes[0], OccupancyBlock(10.0, Double.POSITIVE_INFINITY, 0.0, 1.0),
            routes[3], OccupancyBlock(0.0, 1200.0, 0.0, 1.0),
            routes[3], OccupancyBlock(1300.0, Double.POSITIVE_INFINITY, 0.0, 1.0)
        )
        val timeStep = 2.0
        val infra = infraBuilder.build()
        val allowance = AllowanceValue.Percentage(20.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .setStandardAllowance(allowance)
                .addStep(
                    STDCMStep(
                        setOf(
                            EdgeLocation(
                                routes[0], 0.0
                            )
                        ), 0.0, true
                    )
                )
                .addStep(
                    STDCMStep(
                        setOf(
                            EdgeLocation(
                                routes[1], 50.0
                            )
                        ), 1000.0, true
                    )
                )
                .addStep(
                    STDCMStep(
                        setOf(
                            EdgeLocation(
                                routes[3], 1.0
                            )
                        ), 0.0, true
                    )
                )
        )
        val expectedStops = listOf(
            TrainStop(51.0, 1000.0)
        )
        checkStop(res.withAllowance, expectedStops)
        checkStop(res.withoutAllowance, expectedStops)
        occupancyTest(res.withAllowance, occupancy, 2 * timeStep)
        occupancyTest(res.withoutAllowance, occupancy, 2 * timeStep)
    }

    companion object {
        /** Check that the train actually stops at the expected times and positions  */
        private fun checkStop(res: STDCMResult?, expectedStops: List<TrainStop>) {
            // Check that the stops are properly returned
            Assertions.assertEquals(
                expectedStops,
                res!!.stopResults
            )

            // Check that we stop
            for (stop in expectedStops) Assertions.assertEquals(
                0.0,
                res.envelope.interpolateSpeed(stop.position),
                TrainPhysicsIntegrator.SPEED_EPSILON
            )
        }
    }
}
