package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.StandardAllowanceTests.Companion.checkAllowanceResult
import fr.sncf.osrd.stdcm.StandardAllowanceTests.Companion.runWithAndWithoutAllowance
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class StopTests {
    /** Look for a path in an empty timetable, with a stop in the middle of a block */
    @Test
    fun emptyTimetableWithStop() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(secondBlock, Offset(50.meters))), 10000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(secondBlock, Offset(100.meters))), 0.0, true))
                .run()!!
        val expectedOffset = 150.0

        // Check that we stop
        Assertions.assertTrue(
            TrainPhysicsIntegrator.areSpeedsEqual(
                0.0,
                res.envelope.interpolateSpeed(expectedOffset)
            )
        )

        // Check that the stop is properly returned
        Assertions.assertEquals(listOf(TrainStop(expectedOffset, 10000.0, true)), res.stopResults)
    }

    /** Test that we can handle several stops in a row, after waypoints that aren't stops */
    @Test
    fun severalStopsAfterSimpleWaypoints() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val stopsOffsets =
            listOf<Offset<Block>>(
                Offset(10.meters),
                Offset(20.meters),
                Offset(30.meters),
                Offset(40.meters),
            )
        val builder =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters)))))
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(1.meters)))))
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(2.meters)))))
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(3.meters)))))
        for (offset in stopsOffsets) builder.addStep(
            STDCMStep(setOf(EdgeLocation(secondBlock, offset)), 1.0, true)
        )
        val res =
            builder
                .addStep(STDCMStep(setOf(EdgeLocation(secondBlock, Offset(100.meters))), 0.0, true))
                .run()!!

        // Check that we stop
        for (offset in stopsOffsets) Assertions.assertTrue(
            TrainPhysicsIntegrator.areSpeedsEqual(
                0.0,
                res.envelope.interpolateSpeed(100.0 + offset.distance.meters)
            )
        )
    }

    /** Look for a path in an empty timetable, with a stop at the start of a block */
    @Test
    fun emptyTimetableWithStopBlockStart() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(secondBlock, Offset(0.meters))), 10000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(secondBlock, Offset(100.meters))), 0.0, true))
                .run()!!
        checkStop(res, listOf(TrainStop(100.0, 10000.0, true)))
    }

    /** Look for a path in an empty timetable, with a stop at the end of a block */
    @Test
    fun emptyTimetableWithStopBlockEnd() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(firstBlock, Offset(100.meters))), 10000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(secondBlock, Offset(100.meters))), 0.0, true))
                .run()!!
        checkStop(res, listOf(TrainStop(100.0, 10000.0, true)))
    }

    /** Checks that we can make a detour to pass by an intermediate step */
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
        val infra = DummyInfra()
        val blocksDirectPath =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d"),
                infra.addBlock("d", "e")
            )
        val detour =
            listOf(infra.addBlock("b", "x", 100000.meters), infra.addBlock("x", "d", 100000.meters))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .addStep(
                    STDCMStep(
                        setOf(EdgeLocation(blocksDirectPath[0], Offset(0.meters))),
                    )
                )
                .addStep(STDCMStep(setOf(EdgeLocation(detour[1], Offset(1000.meters))), 0.0, stop))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(blocksDirectPath[3], Offset(0.meters))), 0.0, true)
                )
                .run()!!
        val blocks =
            res.blocks.ranges
                .stream()
                .map { edgeRange -> infra.blockPool[edgeRange.edge.index.toInt()].name }
                .toList()
        Assertions.assertEquals(listOf("a->b", "b->x", "x->d", "d->e"), blocks)
        Assertions.assertNotEquals(stop, res.stopResults.isEmpty())
        Assertions.assertEquals(stop, res.envelope.interpolateSpeed(101100.0) == 0.0)
    }

    /**
     * Test that the stop time is properly accounted for, by making the train stop for too long to
     * find a solution
     */
    @Test
    fun testImpossibleSolutionBecauseOfStop() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val unavailableTimes =
            ImmutableMultimap.of(
                secondBlock,
                OccupancySegment(100000.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(firstBlock, Offset(10.meters))), 100000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(secondBlock, Offset(100.meters))), 0.0, true))
                .setUnavailableTimes(unavailableTimes)
                .run()
        assertNull(res)
    }

    /** Checks that we add the right amount of delay with a stop */
    @Test
    fun delayWithStop() {
        /*
        a --> b --> c -> d
         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d", 1.meters)
            )
        val occupancy =
            ImmutableMultimap.of(
                blocks[2],
                OccupancySegment(0.0, 12000.0, 0.meters, 1.meters),
                blocks[2],
                OccupancySegment(12010.0, Double.POSITIVE_INFINITY, 0.meters, 1.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters)))))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(blocks[0], Offset(50.meters))), 10000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[2], Offset(1.meters))), 0.0, true))
                .setUnavailableTimes(occupancy)
                .run()!!
        checkStop(res, listOf(TrainStop(50.0, 10000.0, true)))
        occupancyTest(res, occupancy)
    }

    /** Checks that we can handle a standard allowance with a stop */
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
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", 1.meters, 20.0),
                infra.addBlock("b", "c", 1000.meters, 20.0),
                infra.addBlock("c", "d", 100.meters, 20.0),
                infra.addBlock("d", "e", 1.meters, 20.0)
            )
        val occupancy =
            ImmutableMultimap.of(
                blocks[3],
                OccupancySegment(0.0, 1200.0, 0.meters, 1.meters),
                blocks[3],
                OccupancySegment(1220.0, Double.POSITIVE_INFINITY, 0.meters, 1.meters)
            )
        val timeStep = 2.0
        val allowance = AllowanceValue.Percentage(20.0)
        val res =
            runWithAndWithoutAllowance(
                STDCMPathfindingBuilder()
                    .setInfra(infra.fullInfra())
                    .setUnavailableTimes(occupancy)
                    .setTimeStep(timeStep)
                    .setStandardAllowance(allowance)
                    .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters)))))
                    .addStep(
                        STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 1000.0, true)
                    )
                    .addStep(STDCMStep(setOf(EdgeLocation(blocks[3], Offset(1.meters))), 0.0, true))
            )
        val expectedStops = listOf(TrainStop(51.0, 1000.0, true))
        checkStop(res.withAllowance!!, expectedStops)
        checkStop(res.withoutAllowance!!, expectedStops)
        occupancyTest(res.withAllowance, occupancy, 2 * timeStep)
        occupancyTest(res.withoutAllowance, occupancy, 2 * timeStep)
        checkAllowanceResult(res, allowance, 4 * timeStep)
    }

    /** Checks that we can handle both a standard and engineering allowance with a stop */
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
        c |    __________/## <-- stop
          |   /
        b |  /
          | /##################
        a |/_##################_> time

         */

        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", 1.meters, 20.0),
                infra.addBlock("b", "c", 1000.meters, 20.0),
                infra.addBlock("c", "d", 1000.meters, 20.0),
                infra.addBlock("d", "e", 1.meters, 20.0)
            )
        // Checked empirically, can be tweaked if relevant
        val departureTimeFromStop = 1027.0
        val occupancy =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(10.0, Double.POSITIVE_INFINITY, 0.meters, 1.meters),
                blocks[1],
                OccupancySegment(
                    departureTimeFromStop,
                    Double.POSITIVE_INFINITY,
                    50.meters,
                    50.meters
                ),
                blocks[3],
                OccupancySegment(0.0, 1200.0, 0.meters, 1.meters),
                blocks[3],
                OccupancySegment(1300.0, Double.POSITIVE_INFINITY, 0.meters, 1.meters)
            )
        val timeStep = 2.0
        val allowance = AllowanceValue.Percentage(20.0)
        val res =
            runWithAndWithoutAllowance(
                STDCMPathfindingBuilder()
                    .setInfra(infra.fullInfra())
                    .setUnavailableTimes(occupancy)
                    .setTimeStep(timeStep)
                    .setStandardAllowance(allowance)
                    .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters)))))
                    .addStep(
                        STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 1000.0, true)
                    )
                    .addStep(STDCMStep(setOf(EdgeLocation(blocks[3], Offset(1.meters))), 0.0, true))
            )
        val expectedStops = listOf(TrainStop(51.0, 1000.0, true))
        checkStop(res.withAllowance!!, expectedStops)
        checkStop(res.withoutAllowance!!, expectedStops)
        occupancyTest(res.withAllowance, occupancy, 2 * timeStep)
        occupancyTest(res.withoutAllowance, occupancy, 2 * timeStep)
    }

    /** Checks that the stop itself is accounted for when detecting conflicts */
    @Test
    fun conflictDuringStop() {
        /*
        a --> b --> c -> d
                 ^
                stop

        space
          ^
        d |                 /
          |                /
        c |               /
          |    ___####___/   <-- stop
          |   /   ####
        b |  /
          | /
        a |/____________________> time

         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d", 1.meters)
            )
        val occupancy =
            ImmutableMultimap.of(
                blocks[1],
                OccupancySegment(300.0, 600.0, 0.meters, 100.meters),
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters)))))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 10_000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[2], Offset(1.meters))), 0.0, true))
                .setUnavailableTimes(occupancy)
                .setMaxDepartureDelay(0.0) // Prevents the train from starting after the conflict
                .run()
        assertNull(res)
    }

    /** Checks that we can make the stop longer to avoid conflicts */
    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun variableStopTime(withAllowance: Boolean) {
        /*
        a --> b --> c -> d
                 ^
                stop

        space
          ^
        d |################ /
          |################/
        c |               /
          |    __(______)/   <-- stop
          |   /
        b |  /
          | /
        a |/____________________> time

         */
        val infra = DummyInfra()
        val timeStep = 2.0
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d", 1.meters)
            )
        val occupancy =
            ImmutableMultimap.of(
                blocks[2],
                OccupancySegment(0.0, 10_000.0, 0.meters, 1.meters),
            )
        var builderWithoutConflict =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters)))))
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 1.0, true))
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[2], Offset(1.meters))), 0.0, true))
                .setMaxDepartureDelay(0.0) // Prevents the train from starting after the conflict
                .setTimeStep(timeStep)
        if (withAllowance)
            builderWithoutConflict =
                builderWithoutConflict.setStandardAllowance(AllowanceValue.Percentage(10.0))
        val builderWithConflict = builderWithoutConflict.copy().setUnavailableTimes(occupancy)
        val resWithoutConflict = builderWithoutConflict.run()!!
        val resWithConflict = builderWithConflict.run()!!

        // Check that there's no slowing down, no engineering allowance
        val resTravelTime = resWithConflict.envelope.totalTime
        assertEquals(resWithoutConflict.envelope.totalTime, resTravelTime, timeStep)

        // Check that the stop is long enough
        assertEquals(
            resWithConflict.stopResults.first().duration,
            10_000 - resTravelTime,
            2 * timeStep
        )
        occupancyTest(resWithConflict, occupancy)
    }

    /** Checks that we can follow start scheduled points and adjust stop durations */
    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun variableStopTimeWithScheduledStart(occupancyAtStart: Boolean) {
        /*
        a --> b --> c -> d
                 ^
                stop

        Tricky case: when exploring with the earliest start time,
        we need to make the stop longer to avoid a conflict.
        When shifting to start at the requested time, we remove
        the extra stop duration that isn't needed anymore,
        back to the minimum stop duration

        The optional occupancy at start checks that we prioritize
        the correct edge

        space
          ^
        d |################## /   /
          |##################/   /
        c |                 /   /
          |    ____________/___/  <-- stop
          |   /        /
        b |  /        /
          | / (##)   /
        a |/__(##)__x___________> time
                    ^
            requested start time
         */
        val infra = DummyInfra()
        val timeStep = 2.0
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d", 1.meters)
            )
        val occupancy =
            if (occupancyAtStart)
                ImmutableMultimap.of(
                    blocks[0],
                    OccupancySegment(5_000.0, 6_000.0, 0.meters, 100.meters),
                    blocks[2],
                    OccupancySegment(0.0, 10_000.0, 0.meters, 1.meters),
                )
            else
                ImmutableMultimap.of(
                    blocks[2],
                    OccupancySegment(0.0, 10_000.0, 0.meters, 1.meters),
                )
        var res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(
                    STDCMStep(
                        setOf(EdgeLocation(blocks[0], Offset(0.meters))),
                        plannedTimingData =
                            PlannedTimingData(7_000.seconds, 7_000.seconds, 3_000.seconds)
                    )
                )
                .addStep(
                    STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 5_000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[2], Offset(1.meters))), 0.0, true))
                .setTimeStep(timeStep)
                .setUnavailableTimes(occupancy)
                .run()!!
        occupancyTest(res, occupancy)
        assertEquals(7_000.0, res.departureTime, timeStep)
        assertEquals(5_000.0, res.stopResults.first().duration, timeStep)
    }

    /** Checks that we can follow end scheduled points and adjust stop durations */
    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun variableStopTimeWithScheduledEnd(occupancyAtEnd: Boolean) {
        /*
        a --> b --> c -> d
                 ^
                stop

        space             requested arrival time
          ^                         v
        d |################## / (##)  x
          |##################/  (##) /
        c |                 /       /
          |    ____________/_______/  <-- stop
          |   /        /
        b |  /        /
          | /  ##### /
        a |/__ #####/___________> time

         */
        val infra = DummyInfra()
        val timeStep = 2.0
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d", 1.meters)
            )
        val occupancy =
            if (occupancyAtEnd)
                ImmutableMultimap.of(
                    blocks[0],
                    OccupancySegment(2_000.0, 3_000.0, 0.meters, 100.meters),
                    blocks[2],
                    OccupancySegment(0.0, 10_000.0, 0.meters, 1.meters),
                    blocks[2],
                    OccupancySegment(12_000.0, 13_000.0, 0.meters, 1.meters),
                )
            else
                ImmutableMultimap.of(
                    blocks[0],
                    OccupancySegment(2_000.0, 3_000.0, 0.meters, 100.meters),
                    blocks[2],
                    OccupancySegment(0.0, 10_000.0, 0.meters, 1.meters),
                )
        var res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters)))))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 5_000.0, true)
                )
                .addStep(
                    STDCMStep(
                        setOf(EdgeLocation(blocks[2], Offset(1.meters))),
                        0.0,
                        true,
                        plannedTimingData =
                            PlannedTimingData(15_000.seconds, 15_000.seconds, 15_000.seconds)
                    )
                )
                .setMaxDepartureDelay(Double.POSITIVE_INFINITY)
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancy)
        val arrivalTime =
            res.departureTime + res.envelope.totalTime + res.stopResults.first().duration
        assertEquals(3_000.0, res.departureTime, timeStep)
        assertEquals(15_000.0, arrivalTime, timeStep)
    }

    companion object {
        /** Check that the train actually stops at the expected times and positions */
        private fun checkStop(
            res: STDCMResult,
            expectedStops: List<TrainStop>,
            allowLonger: Boolean = true
        ) {
            // Check that the stops are properly returned
            assertEquals(expectedStops.size, res.stopResults.size)
            for ((expected, actual) in expectedStops zip res.stopResults) {
                if (allowLonger) assertTrue(expected.duration <= actual.duration)
                else assertEquals(expected.duration, actual.duration)
                assertEquals(expected.position, actual.position)
            }

            // Check that we stop
            for (stop in expectedStops) Assertions.assertTrue(
                TrainPhysicsIntegrator.areSpeedsEqual(
                    0.0,
                    res.envelope.interpolateSpeed(stop.position)
                )
            )
        }
    }
}
