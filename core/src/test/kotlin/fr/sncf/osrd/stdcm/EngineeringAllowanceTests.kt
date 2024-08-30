package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.graph.simulateBlock
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
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
                infra,
                infraExplorerFromBlock(infra, infra, firstBlock),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null
            )!!
        val secondBlockEnvelope =
            simulateBlock(
                infra,
                infraExplorerFromBlock(infra, infra, secondBlock),
                firstBlockEnvelope.endSpeed,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null
            )!!
        val timeThirdBlockFree = firstBlockEnvelope.totalTime + secondBlockEnvelope.totalTime
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(
                    firstBlockEnvelope.totalTime + 10,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    1000.meters
                ),
                thirdBlock,
                OccupancySegment(0.0, timeThirdBlockFree + 30, 0.meters, 100.meters)
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(thirdBlock, Offset<Block>(1.meters))))
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
                infra,
                infraExplorerFromBlock(infra, infra, firstBlock),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null
            )!!
        val secondBlockEnvelope =
            simulateBlock(
                infra,
                infraExplorerFromBlock(infra, infra, secondBlock),
                firstBlockEnvelope.endSpeed,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null
            )!!
        val timeLastBlockFree =
            firstBlockEnvelope.totalTime + 120 + secondBlockEnvelope.totalTime * 3
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(
                    firstBlockEnvelope.totalTime + timeStep,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    1000.meters
                ),
                lastBlock,
                OccupancySegment(0.0, timeLastBlockFree, 0.meters, 1000.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset<Block>(1000.meters))))
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
                infra,
                infraExplorerFromBlock(infra, infra, firstBlock),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null
            )!!
        val secondBlockEnvelope =
            simulateBlock(
                infra,
                infraExplorerFromBlock(infra, infra, secondBlock),
                firstBlockEnvelope.endSpeed,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null
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
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    1000.meters
                ),
                lastBlock,
                OccupancySegment(0.0, timeLastBlockFree, 0.meters, 1000.meters),
                thirdBlock,
                OccupancySegment(
                    timeThirdBlockOccupied,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    1000.meters
                )
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset<Block>(1000.meters))))
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
                OccupancySegment(0.0, timeThirdBlockFree, 0.meters, 1.meters)
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(thirdBlock, Offset<Block>(1.meters))))
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
                OccupancySegment(2000.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(0.0, 1200.0, 0.meters, 100.meters),
                thirdBlock,
                OccupancySegment(0.0, 1800.0, 0.meters, 100.meters),
                forthBlock,
                OccupancySegment(0.0, 4000.0, 0.meters, 100.meters)
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(forthBlock, Offset<Block>(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
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
                infra.addBlock("c", "d", 1000.meters)
            )
        val occupancyGraph =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(300.0, Double.POSITIVE_INFINITY, 0.meters, 1000.meters),
                blocks[2],
                OccupancySegment(0.0, 3600.0, 0.meters, 1000.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[2], Offset<Block>(1000.meters))))
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
        val infra = DummyInfra()
        val blocks =
            listOf(infra.addBlock("a", "b"), infra.addBlock("b", "c"), infra.addBlock("c", "d"))
        val occupancyGraph =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(300.0, 3600.0, 0.meters, 1.meters),
                blocks[2],
                OccupancySegment(0.0, 3600.0, 0.meters, 1.meters)
            )
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[2], Offset<Block>(100.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph)
        Assertions.assertEquals(3600.0, res.departureTime, 2 * timeStep)
    }
}
