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
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters))), 0.0, true))
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
        Assertions.assertEquals(listOf(TrainStop(expectedOffset, 10000.0)), res.stopResults)
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
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters))), 0.0, true))
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(1.meters))), 0.0, false))
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(2.meters))), 0.0, false))
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(3.meters))), 0.0, false))
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
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters))), 0.0, true))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(secondBlock, Offset(0.meters))), 10000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(secondBlock, Offset(100.meters))), 0.0, true))
                .run()!!
        checkStop(res, listOf(TrainStop(100.0, 10000.0)))
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
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters))), 0.0, true))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(firstBlock, Offset(100.meters))), 10000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(secondBlock, Offset(100.meters))), 0.0, true))
                .run()!!
        checkStop(res, listOf(TrainStop(100.0, 10000.0)))
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
                        0.0,
                        false
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
                .addStep(STDCMStep(setOf(EdgeLocation(firstBlock, Offset(0.meters))), 0.0, true))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(firstBlock, Offset(10.meters))), 100000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(secondBlock, Offset(100.meters))), 0.0, true))
                .setUnavailableTimes(unavailableTimes)
                .run()
        Assertions.assertNull(res)
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
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters))), 0.0, true))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(blocks[0], Offset(50.meters))), 10000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[2], Offset(1.meters))), 0.0, true))
                .setUnavailableTimes(occupancy)
                .run()!!
        checkStop(res, listOf(TrainStop(50.0, 10000.0)))
        occupancyTest(res, occupancy)
    }

    /** Checks that we can handle engineering allowance with a stop */
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
                blocks[0],
                OccupancySegment(10.0, Double.POSITIVE_INFINITY, 0.meters, 1.meters),
                blocks[3],
                OccupancySegment(0.0, 1200.0, 0.meters, 1.meters),
                blocks[3],
                OccupancySegment(1220.0, Double.POSITIVE_INFINITY, 0.meters, 1.meters)
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters))), 0.0, true))
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 1000.0, true))
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[3], Offset(1.meters))), 0.0, true))
                .run()!!
        checkStop(res, listOf(TrainStop(51.0, 1000.0)))
        occupancyTest(res, occupancy, 2 * timeStep)
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
                    .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters))), 0.0, true))
                    .addStep(
                        STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 1000.0, true)
                    )
                    .addStep(STDCMStep(setOf(EdgeLocation(blocks[3], Offset(1.meters))), 0.0, true))
            )
        val expectedStops = listOf(TrainStop(51.0, 1000.0))
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
        c |    __________/   <-- stop
          |   /
        b |  /
          | /##################
        a |/_##################_> time

         */

        // Note: this test will need to be updated once we can add delay by making stops longer
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
                blocks[0],
                OccupancySegment(10.0, Double.POSITIVE_INFINITY, 0.meters, 1.meters),
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
                    .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters))), 0.0, true))
                    .addStep(
                        STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 1000.0, true)
                    )
                    .addStep(STDCMStep(setOf(EdgeLocation(blocks[3], Offset(1.meters))), 0.0, true))
            )
        val expectedStops = listOf(TrainStop(51.0, 1000.0))
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
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[0], Offset(0.meters))), 0.0, true))
                .addStep(
                    STDCMStep(setOf(EdgeLocation(blocks[1], Offset(50.meters))), 10_000.0, true)
                )
                .addStep(STDCMStep(setOf(EdgeLocation(blocks[2], Offset(1.meters))), 0.0, true))
                .setUnavailableTimes(occupancy)
                .setMaxDepartureDelay(0.0) // Prevents the train from starting after the conflict
                .run()
        assertNull(res)
    }

    companion object {
        /** Check that the train actually stops at the expected times and positions */
        private fun checkStop(res: STDCMResult, expectedStops: List<TrainStop>) {
            // Check that the stops are properly returned
            Assertions.assertEquals(expectedStops, res.stopResults)

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
