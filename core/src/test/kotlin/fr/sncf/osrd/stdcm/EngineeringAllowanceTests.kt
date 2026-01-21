package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.infra_exploration.BlockLocation
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.train.TestTrains.VERY_LONG_FAST_TRAIN
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.Double.Companion.POSITIVE_INFINITY
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class EngineeringAllowanceTests {
    /** Test that we can add an engineering allowance to avoid an occupied section */
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters, 30.0)
        val secondBlock = infra.addBlock("b", "c", 10000.meters, 30.0)
        val thirdBlock = infra.addBlock("c", "d", 100.meters, 30.0)
        val firstBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(infra, infra, firstBlock),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        val secondBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(infra, infra, secondBlock),
                firstBlockEnvelope.endSpeed,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        val timeThirdBlockFree = firstBlockEnvelope.totalTime + secondBlockEnvelope.totalTime
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(
                    firstBlockEnvelope.totalTime + 10,
                    POSITIVE_INFINITY,
                    0.meters,
                    1000.meters,
                ),
                thirdBlock,
                OccupancySegment(0.0, timeThirdBlockFree + 30, 0.meters, 100.meters),
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(thirdBlock, Offset(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
    }

    /**
     * Test that we can add an engineering allowance over several blocks to avoid an occupied
     * section
     */
    @Test
    fun testSlowdownSeveralBlocks() {
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters, 20.0)
        val secondBlock = infra.addBlock("b", "c", 1000.meters, 20.0)
        infra.addBlock("c", "d", 1000.meters, 20.0)
        infra.addBlock("d", "e", 1000.meters, 20.0)
        val lastBlock = infra.addBlock("e", "f", 1000.meters, 20.0)
        val firstBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(infra, infra, firstBlock),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        val secondBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(infra, infra, secondBlock),
                firstBlockEnvelope.endSpeed,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        val timeLastBlockFree =
            firstBlockEnvelope.totalTime + 120 + secondBlockEnvelope.totalTime * 3
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(
                    firstBlockEnvelope.totalTime + timeStep,
                    POSITIVE_INFINITY,
                    0.meters,
                    1000.meters,
                ),
                lastBlock,
                OccupancySegment(0.0, timeLastBlockFree, 0.meters, 1000.meters),
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(lastBlock, Offset(1000.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
        Assertions.assertEquals(0.0, res.departureTime, 2 * timeStep)
    }

    /** Test that allowances don't cause new conflicts */
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
        would cross the occupancy in the "d->d" block (rightmost curve).

        But another solution exists: keeping the allowance in the "d->e" block (leftmost curve)

         */
        val timeStep = 2.0
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters, 20.0)
        val secondBlock = infra.addBlock("b", "c", 1000.meters, 20.0)
        val thirdBlock = infra.addBlock("c", "d", 1000.meters, 20.0)
        infra.addBlock("d", "e", 1000.meters, 20.0)
        val lastBlock = infra.addBlock("e", "f", 1000.meters, 20.0)
        val firstBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(infra, infra, firstBlock),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        val secondBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(infra, infra, secondBlock),
                firstBlockEnvelope.endSpeed,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        val timeLastBlockFree =
            firstBlockEnvelope.totalTime + 120 + secondBlockEnvelope.totalTime * 3
        val timeThirdBlockOccupied =
            firstBlockEnvelope.totalTime + 5 + secondBlockEnvelope.totalTime * 2
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(
                    firstBlockEnvelope.totalTime + timeStep,
                    POSITIVE_INFINITY,
                    0.meters,
                    1000.meters,
                ),
                lastBlock,
                OccupancySegment(0.0, timeLastBlockFree, 0.meters, 1000.meters),
                thirdBlock,
                OccupancySegment(timeThirdBlockOccupied, POSITIVE_INFINITY, 0.meters, 1000.meters),
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(lastBlock, Offset(1000.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
        Assertions.assertEquals(0.0, res.departureTime, 2 * timeStep)
    }

    /**
     * Test that we can add the max delay by shifting the departure time, then add more delay by
     * slowing down
     */
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters, 30.0)
        val secondBlock = infra.addBlock("b", "c", 1000.meters, 30.0)
        val thirdBlock = infra.addBlock("c", "d", 1.meters, 30.0)
        val lastBlockEntryTime =
            getBlocksRunTime(infra.fullInfra(), listOf(firstBlock, secondBlock))
        val timeThirdBlockFree = lastBlockEntryTime + 3600 * 2 + 60
        val occupancyGraph =
            ImmutableMultimap.of(
                thirdBlock,
                OccupancySegment(0.0, timeThirdBlockFree, 0.meters, 1.meters),
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(thirdBlock, Offset(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph)
        Assertions.assertEquals((3600 * 2).toDouble(), res.departureTime, 2 * timeStep)
        Assertions.assertTrue(res.departureTime <= 3600 * 2)
    }

    /** The allowance happens in an area where we have added delay by shifting the departure time */
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 2000.meters, 20.0)
        val secondBlock = infra.addBlock("b", "c", 2000.meters, 20.0)
        val thirdBlock = infra.addBlock("c", "d", 2000.meters, 20.0)
        val forthBlock = infra.addBlock("d", "e", 2000.meters, 20.0)
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(0.0, 600.0, 0.meters, 100.meters),
                firstBlock,
                OccupancySegment(2000.0, POSITIVE_INFINITY, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(0.0, 1200.0, 0.meters, 100.meters),
                thirdBlock,
                OccupancySegment(0.0, 1800.0, 0.meters, 100.meters),
                forthBlock,
                OccupancySegment(0.0, 4000.0, 0.meters, 100.meters),
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(forthBlock, Offset(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
    }

    /**
     * Similar test as above, but values have been tweaked to reproduce #13910.
     *
     * There's only a short opening around the area of the first engineering allowance.
     */
    @Test
    fun testSeveralDelaysWithLargeTimeDiff() {
        /*
        Occupancy graph is similar to this (with lots of blocks and long durations):

        space
          ^
          |########################################
          |######################################
          |####################################
          |##################################
          |################################
          |##########*
          |          ^
          |
          |
          start ###########################################-> time

          Each block in the second half has its own engineering allowance.
          They all extend back to the path start.

          At first, there's only one fixed time point at the end.
          Then one is added at the first conflict location, the point
          marked with a star. It's then impossible to add an engineering
          allowance that avoids the next conflict.
         */
        val infra = DummyInfra()
        val length = 2_000.meters
        val blocks = mutableListOf<BlockId>()
        for (i in 0..20) {
            blocks.add(infra.addBlock(i.toString(), (i + 1).toString(), length, 10.0))
        }

        val occupancyGraphBuilder = ImmutableMultimap.builder<BlockId, OccupancySegment>()
        fun segment(blockIndex: Int, from: Double, to: Double) {
            occupancyGraphBuilder.put(
                blocks[blockIndex],
                OccupancySegment(from, to, 0.meters, length),
            )
        }

        // Very large values makes the error easier to reproduce
        val t = 300_000.0
        segment(9, 0.0, t - 20_000.0)
        for (i in 0..10) {
            val from = t + i * 300.0
            segment(10 + i, 0.0, from)
        }

        val occupancyGraph = occupancyGraphBuilder.build()
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(blocks.first(), Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(blocks.last(), Offset(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setMaxRunTime(POSITIVE_INFINITY)
                .setMaxDepartureDelay(0.0)
                .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /**
     * Similar test as above, but values have been tweaked to reproduce #12541. Distances are too
     * short to actually run an engineering allowance.
     */
    @Test
    fun testSeveralDelaysWithConflictAtStart() {
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
        b | /          /    /   ######################
          |/          /    /    ######################
        a start______/____/_____#######################> time

         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val thirdBlock = infra.addBlock("c", "d")
        val forthBlock = infra.addBlock("d", "e")
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(1_000.0, POSITIVE_INFINITY, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(0.0, 800.0, 0.meters, 100.meters),
                thirdBlock,
                OccupancySegment(0.0, 1_200.0, 0.meters, 100.meters),
                forthBlock,
                OccupancySegment(0.0, 1_200.0, 0.meters, 100.meters),
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(forthBlock, Offset(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setMaxRunTime(POSITIVE_INFINITY)
                .run() ?: return // No solution found is valid here (and expected)
        // But if we find a solution there must be no conflict
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we return null with no crash when we can't slow down fast enough */
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

        The second block is very short and not long enough to slow down

         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", 1000.meters),
                infra.addBlock("b", "c", 1.meters),
                infra.addBlock("c", "d", 1000.meters),
            )
        val occupancyGraph =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(300.0, POSITIVE_INFINITY, 0.meters, 1000.meters),
                blocks[2],
                OccupancySegment(0.0, 3600.0, 0.meters, 1000.meters),
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(blocks[2], Offset(1000.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setMaxDepartureDelay(POSITIVE_INFINITY)
                .run()
        Assertions.assertNull(res)
    }

    @Test
    fun testOverwrittenEngineeringAllowance() {
        /*
        a --> b --> c --> d --> e --> f

        space
          ^                    end
        f |###################### /
          |#################x####/
        e |#############  _/    /
          |#############_/   __/
        d |           _/  __/
          |         _/ __/
        c |       _/__/
          |     _/_/
        b |   _/
          |  /#######################
        a |_/_#######################> time

        First engineering allowance to avoid the conflict at d->e,
        which is then overwritten by the allowance to avoid the
        conflict at e->f

         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", 1000.meters),
                infra.addBlock("b", "c", 50_000.meters),
                infra.addBlock("c", "d", 20_000.meters),
                infra.addBlock("d", "e", 1000.meters),
                infra.addBlock("e", "f", 1000.meters),
            )
        val occupancyGraph =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(600.0, POSITIVE_INFINITY, 0.meters, 1000.meters),
                blocks[3],
                OccupancySegment(0.0, 2900.0, 0.meters, 1000.meters),
                blocks[4],
                OccupancySegment(0.0, 3000.0, 0.meters, 1000.meters),
            )
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(setOf(BlockLocation(blocks[0], Offset(0.meters))))
            .setEndLocations(setOf(BlockLocation(blocks[4], Offset(1000.meters))))
            .setUnavailableTimes(occupancyGraph)
            .setMaxDepartureDelay(POSITIVE_INFINITY)
            .setMaxRunTime(POSITIVE_INFINITY)
            .run()!!
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
        val infra = DummyInfra()
        val blocks =
            listOf(infra.addBlock("a", "b"), infra.addBlock("b", "c"), infra.addBlock("c", "d"))
        val occupancyGraph =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(300.0, 3600.0, 0.meters, 1.meters),
                blocks[2],
                OccupancySegment(0.0, 3600.0, 0.meters, 1.meters),
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(blocks[2], Offset(100.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph)
        Assertions.assertEquals(3600.0, res.departureTime, 2 * timeStep)
    }

    /**
     * Reproduces a bug: the engineering allowance area has a very low speed limit, to the point
     * where we reach speed=0 within one step.
     */
    @Test
    fun testSlowdownWithLowLimitSpeed() {
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters, 0.5)
        val secondBlock = infra.addBlock("b", "c", 10000.meters, 0.5)
        val thirdBlock = infra.addBlock("c", "d", 100.meters, 0.5)
        val firstBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(infra, infra, firstBlock),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        val secondBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(infra, infra, secondBlock),
                firstBlockEnvelope.endSpeed,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        val timeThirdBlockFree = firstBlockEnvelope.totalTime + secondBlockEnvelope.totalTime
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(
                    firstBlockEnvelope.totalTime + 10,
                    POSITIVE_INFINITY,
                    0.meters,
                    1000.meters,
                ),
                thirdBlock,
                OccupancySegment(0.0, timeThirdBlockFree + 30, 0.meters, 100.meters),
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(thirdBlock, Offset(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
    }

    /**
     * Reproduce a bug: this engineering allowance setup forces the train to be planned as close as
     * possible to the unoccupied section in the first blocks. But because the gradients don't carry
     * over block transitions, the post-processing simulation has worse gradients in the second
     * blocks compared to the sims during the search.
     */
    @Test
    fun testVeryLongTrainWithSlopes() {
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", 100.meters, 60.0, gradient = 40.0),
                infra.addBlock("b", "c", 2_000.meters, 60.0),
                infra.addBlock("c", "d", 2_000.meters, 60.0),
                infra.addBlock("d", "e", 2_000.meters, 30.0),
                infra.addBlock("e", "f", 100.meters, 30.0),
            )
        val occupancyGraph =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(150.0, POSITIVE_INFINITY, 0.meters, 100.meters),
                blocks[1],
                OccupancySegment(150.0, POSITIVE_INFINITY, 0.meters, 2_000.meters),
                blocks.last(),
                OccupancySegment(0.0, 2 * 3600.0, 0.meters, 100.meters),
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(blocks.first(), Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(blocks.last(), Offset(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .setRollingStock(VERY_LONG_FAST_TRAIN)
                .setStandardAllowance(AllowanceValue.Percentage(10.0))
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
    }
}
