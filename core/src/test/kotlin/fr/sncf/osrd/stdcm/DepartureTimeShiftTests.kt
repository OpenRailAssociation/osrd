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
import java.util.stream.Collectors
import kotlin.test.assertNull
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class DepartureTimeShiftTests {
    /** Test that we can add delays to avoid occupied sections */
    @Test
    fun testSimpleDelay() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val occupancyGraph =
            ImmutableMultimap.of(secondBlock, OccupancySegment(0.0, 3600.0, 0.meters, 100.meters))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset<Block>(50.meters))))
                .run()!!
        val secondBlockEntryTime =
            (res.departureTime +
                res.envelope.interpolateArrivalAt(infra.getBlockLength(firstBlock).distance.meters))
        Assertions.assertTrue(secondBlockEntryTime >= 3600)
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we can add delays to avoid several occupied blocks */
    @Test
    fun testSimpleSeveralBlocks() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val occupancyGraph =
            ImmutableMultimap.of(
                secondBlock,
                OccupancySegment(0.0, 1200.0, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(1200.0, 2400.0, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(2400.0, 3600.0, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset<Block>(50.meters))))
                .run()!!
        val secondBlockEntryTime =
            (res.departureTime +
                res.envelope.interpolateArrivalAt(infra.getBlockLength(firstBlock).distance.meters))
        Assertions.assertTrue(secondBlockEntryTime >= 3600)
        occupancyTest(res, occupancyGraph)
    }

    /**
     * Test that the path we find is the one with the earliest arrival time rather than the shortest
     */
    @Test
    fun testEarliestArrivalTime() {
        /*
        Top path is shorter but has a very low speed limit
        We should use the bottom path (higher speed limit)
        First and last blocks are very long for speedup and slowdown

                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        infra.addBlock("b", "c1", 50.meters, 1.0)
        infra.addBlock("b", "c2")
        infra.addBlock("c1", "d", 50.meters, 1.0)
        infra.addBlock("c2", "d")
        val lastBlock = infra.addBlock("d", "e", 1000.meters)
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset<Block>(1000.meters))))
                .run()!!
        val blocks =
            res.blocks.ranges
                .stream()
                .map { edgeRange -> infra.blockPool[edgeRange.edge.index.toInt()].name }
                .collect(Collectors.toSet())
        Assertions.assertTrue(blocks.contains("b->c2"))
        Assertions.assertTrue(blocks.contains("c2->d"))
        Assertions.assertFalse(blocks.contains("b->c1"))
        Assertions.assertFalse(blocks.contains("c1->d"))
    }

    /**
     * Test that the path we find is the one with the earliest arrival time rather than the shortest
     * while taking into account departure time delay caused by the first block occupancy
     */
    @Test
    fun testEarliestArrivalTimeWithOccupancy() {
        /*
        Top path is shorter but is occupied at start
        Bot path is longer but can be used with no delay
        We should use the top path (earlier arrival time)
        First and last blocks are very long for speedup and slowdown

                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        infra.addBlock("b", "c1")
        val delayedBlock = infra.addBlock("b", "c2", 50.meters)
        infra.addBlock("c1", "d")
        infra.addBlock("c2", "d")
        val lastBlock = infra.addBlock("d", "e", 1000.meters)
        val occupancyGraph =
            ImmutableMultimap.of(delayedBlock, OccupancySegment(0.0, 10000.0, 0.meters, 50.meters))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset<Block>(1000.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()!!
        val blocks =
            res.blocks.ranges
                .stream()
                .map { edgeRange -> infra.blockPool[edgeRange.edge.index.toInt()].name }
                .collect(Collectors.toSet())
        Assertions.assertTrue(blocks.contains("b->c1"))
        Assertions.assertTrue(blocks.contains("c1->d"))
        Assertions.assertFalse(blocks.contains("b->c2"))
        Assertions.assertFalse(blocks.contains("c2->d"))
    }

    /** Test that we don't add too much delay, crossing over occupied sections in previous blocks */
    @Test
    fun testImpossibleAddedDelay() {
        /*
        a --> b --> c --> d
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
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
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(
                    firstBlockEnvelope.totalTime + 10,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    100.meters
                ),
                secondBlock,
                OccupancySegment(0.0, 3600.0, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset<Block>(100.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()
        Assertions.assertNull(res)
    }

    /**
     * Test that we can backtrack when the first "opening" doesn't lead to a valid solution. To do
     * this, we need to consider that the same block at different times can be different edges
     */
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val thirdBlock = infra.addBlock("c", "d")
        val occupancyGraph =
            ImmutableMultimap.of(
                secondBlock,
                OccupancySegment(300.0, 500.0, 0.meters, 100.meters),
                thirdBlock,
                OccupancySegment(0.0, 500.0, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(thirdBlock, Offset<Block>(50.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** This is the same test as the one above, but with the split on the first block. */
    @Test
    fun testTwoOpeningsFirstBlock() {
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(300.0, 500.0, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(0.0, 500.0, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset<Block>(50.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** This is the same test as the one above, but with the split on the last block. */
    @Test
    fun testTwoOpeningsLastBlock() {
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val occupancyGraph =
            ImmutableMultimap.of(secondBlock, OccupancySegment(300.0, 500.0, 0.meters, 100.meters))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset<Block>(50.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we keep track of how much we can shift the departure time over several blocks */
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        infra.addBlock("c", "d", 1.meters) // Very short to prevent slowdowns
        val forthBlock = infra.addBlock("d", "e")
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(1200.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(600.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters),
                forthBlock,
                OccupancySegment(0.0, 1000.0, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(forthBlock, Offset<Block>(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()
        Assertions.assertNull(res)
    }

    /**
     * We shift de departure time a little more at each block, we test that we still keep track of
     * how much we can shift. This test may need tweaking / removal once we consider slowdowns.
     */
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val thirdBlock = infra.addBlock("c", "d")
        val forthBlock = infra.addBlock("d", "e")
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(0.0, 200.0, 0.meters, 100.meters),
                firstBlock,
                OccupancySegment(500.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(0.0, 400.0, 0.meters, 100.meters),
                thirdBlock,
                OccupancySegment(0.0, 600.0, 0.meters, 100.meters),
                forthBlock,
                OccupancySegment(0.0, 800.0, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(forthBlock, Offset<Block>(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()
        Assertions.assertNull(res)
    }

    /** Test that we can consider more than two openings */
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val thirdBlock = infra.addBlock("c", "d")
        val occupancyGraph =
            ImmutableMultimap.of(
                secondBlock,
                OccupancySegment(300.0, 600.0, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(900.0, 1200.0, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(1500.0, 1800.0, 0.meters, 100.meters),
                thirdBlock,
                OccupancySegment(0.0, 1200.0, 0.meters, 100.meters),
                thirdBlock,
                OccupancySegment(1500.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(thirdBlock, Offset<Block>(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we don't add more delay than specified */
    @Test
    fun testMaximumDepartureTimeDelay() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val lastBlock = infra.addBlock("b", "c")
        val occupancyGraph =
            ImmutableMultimap.of(firstBlock, OccupancySegment(0.0, 1000.0, 0.meters, 100.meters))
        val timeStep = 2.0
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(lastBlock, Offset(0.meters))))
            .setUnavailableTimes(occupancyGraph)
            .setTimeStep(timeStep)
            .setMaxDepartureDelay(1000 + 2 * timeStep)
            .run()!!
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset<Block>(0.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .setMaxDepartureDelay(1000 - 2 * timeStep)
                .run()
        assertNull(res)
    }
}
