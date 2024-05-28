package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class STDCMPathfindingTests {
    /** Look for a path in an empty timetable */
    @Test
    fun emptyTimetable() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(secondBlock, Offset(50.meters))))
            .run()!!
    }

    /** Look for a path starting and ending in the middle of blocks */
    @Test
    fun partialBlocks() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(30.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset(30.meters))))
                .run()!!
        Assertions.assertEquals(100.meters, res.trainPath.getLength())
    }

    /** Look for a path where the blocks are occupied before and after */
    @Test
    fun betweenTrains() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(0.0, 50.0, 0.meters, 100.meters),
                firstBlock,
                OccupancySegment(10000.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(0.0, 50.0, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(10000.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset(50.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** Test that no path is found when the blocks aren't connected */
    @Test
    fun disconnectedBlocks() {
        /*
        a --> b

        x --> y
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("x", "y")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset(0.meters))))
                .run()
        Assertions.assertNull(res)
    }

    /** Test that no path is found if the first block is free for a very short interval */
    @Test
    fun impossiblePath() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(0.0, 99.0, 0.meters, 100.meters),
                firstBlock,
                OccupancySegment(101.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(0.0, 50.0, 0.meters, 100.meters),
                secondBlock,
                OccupancySegment(1000.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100.0)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset(50.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()
        Assertions.assertNull(res)
    }

    /** Test that we can find a path even if the last block is occupied when the train starts */
    @Test
    fun lastBlockOccupiedAtStart() {
        /*
        a ------> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        val secondBlock = infra.addBlock("b", "c")
        val occupancyGraph =
            ImmutableMultimap.of(secondBlock, OccupancySegment(0.0, 10.0, 0.meters, 100.meters))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset(50.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()!!
        occupancyTest(res, occupancyGraph)
    }

    /** Test that the path can change depending on the occupancy */
    @Test
    fun testAvoidBlockedBlocks() {
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val blockTop = infra.addBlock("b", "c1")
        val blockBottom = infra.addBlock("b", "c2")
        infra.addBlock("c1", "d")
        infra.addBlock("c2", "d")
        val lastBlock = infra.addBlock("d", "e")
        val occupancyGraph1 =
            ImmutableMultimap.of(
                blockTop,
                OccupancySegment(0.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters)
            )
        val occupancyGraph2 =
            ImmutableMultimap.of(
                blockBottom,
                OccupancySegment(0.0, Double.POSITIVE_INFINITY, 0.meters, 100.meters)
            )
        val res1 =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset(50.meters))))
                .setUnavailableTimes(occupancyGraph1)
                .run()!!
        val res2 =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset(50.meters))))
                .setUnavailableTimes(occupancyGraph2)
                .run()!!
        val blocks1 =
            res1.blocks.ranges
                .stream()
                .map { block -> infra.blockPool[block.edge.index.toInt()].name }
                .toList()
        val blocks2 =
            res2.blocks.ranges
                .stream()
                .map { block -> infra.blockPool[block.edge.index.toInt()].name }
                .toList()
        assertFalse(blocks1.contains("b->c1"))
        assertTrue(blocks1.contains("b->c2"))
        occupancyTest(res1, occupancyGraph1)
        assertFalse(blocks2.contains("b->c2"))
        assertTrue(blocks2.contains("b->c1"))
        occupancyTest(res2, occupancyGraph2)
    }

    /** Test that everything works well when the train is at max speed during block transitions */
    @Test
    fun veryLongPathTest() {
        /*
        a ------> b -----> c ------> d
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 10000.meters)
        infra.addBlock("b", "c", 10000.meters)
        val lastBlock = infra.addBlock("c", "d", 10000.meters)
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(lastBlock, Offset(9000.meters))))
            .run()!!
    }

    /** Test that we avoid a path that the train can't use because of a high slope */
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
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        infra.addBlock("b", "c1")
        infra.addBlock("b", "c2")
        val blockTop = infra.addBlock("c1", "d")
        infra.addBlock("c2", "d")
        val lastBlock = infra.addBlock("d", "e")
        infra.blockPool[blockTop.index.toInt()].gradient = 1000.0
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(lastBlock, Offset(50.meters))))
            .run()!!
    }

    /** Test that we don't enter infinite loops */
    @Test
    fun testImpossiblePathWithLoop() {
        /*
        a --> b
        ^----/

        x --> y
         */
        val infra = DummyInfra()
        val firstLoop = infra.addBlock("a", "b")
        infra.addBlock("b", "a")
        val disconnectedBlock = infra.addBlock("x", "y")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstLoop, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(disconnectedBlock, Offset(0.meters))))
                .run()
        Assertions.assertNull(res)
    }

    /**
     * Test that we check that the total run time doesn't exceed the threshold if it happens after
     * the edge start
     */
    @Test
    fun testTotalRunTimeLongEdge() {
        /*
        a ---------> b
         */
        val infra = DummyInfra()
        val block = infra.addBlock("a", "b", 10000.meters)
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(block, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(block, Offset(10000.meters))))
                .setMaxRunTime(100.0)
                .run()
        Assertions.assertNull(res)
    }

    /**
     * Test that we check that the total run time doesn't exceed the threshold with many small edges
     */
    @Test
    fun testTotalRunTimeShortEdges() {
        /*
        1 --> 2 --> ... --> 10
         */
        val infra = DummyInfra()
        val blocks = ArrayList<BlockId>()
        for (i in 0..9) blocks.add(
            infra.addBlock((i + 1).toString(), (i + 2).toString(), 1000.meters)
        )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[9], Offset(1000.meters))))
                .setMaxRunTime(100.0)
                .run()
        Assertions.assertNull(res)
    }

    /** Test that the start delay isn't included in the total run time */
    @Test
    fun testMaxRunTimeWithDelay() {
        /*
        a --> b
         */
        val timeStep = 2.0
        val infra = DummyInfra()
        val block = infra.addBlock("a", "b")
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(setOf(EdgeLocation(block, Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(block, Offset(100.meters))))
            .setUnavailableTimes(
                ImmutableMultimap.of(block, OccupancySegment(0.0, 1000.0, 0.meters, 100.meters))
            )
            .setMaxDepartureDelay(1000 + 2 * timeStep)
            .setMaxRunTime(100.0)
            .setTimeStep(timeStep)
            .run()!!
    }

    /** Test that we ignore occupancy that happen after the end goal */
    @Test
    fun testOccupancyEnvelopeLengthBlockSize() {
        /*
        a -(start) -> (end) ---------------[occupied]---------> b

        The block is occupied after the destination
         */
        val infra = DummyInfra()
        val block = infra.addBlock("a", "b", 100000.meters)
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(setOf(EdgeLocation(block, Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(block, Offset(10.meters))))
            .setUnavailableTimes(
                ImmutableMultimap.of(
                    block,
                    OccupancySegment(0.0, Double.POSITIVE_INFINITY, 99000.meters, 100000.meters)
                )
            )
            .run()!!
    }

    /** Test that we don't use the full block envelope when the destination is close to the start */
    @Test
    fun testOccupancyEnvelopeLength() {
        /*
        a -(start) -> (end) ------------------------> b

        The destination is reached early and the block is occupied after a while
         */
        val infra = DummyInfra()
        val block = infra.addBlock("a", "b", 100000.meters)
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(setOf(EdgeLocation(block, Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(block, Offset(10.meters))))
            .setUnavailableTimes(
                ImmutableMultimap.of(
                    block,
                    OccupancySegment(300.0, Double.POSITIVE_INFINITY, 0.meters, 100000.meters)
                )
            )
            .run()!!
    }

    /** Test that we can visit the same "opening" several times at very different times */
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
        val infra = DummyInfra()
        val blocks =
            listOf(infra.addBlock("a", "b"), infra.addBlock("b", "c"), infra.addBlock("c", "d"))
        val runTime = getBlocksRunTime(infra.fullInfra(), blocks)
        val occupancyGraph =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(300.0, 3600.0, 0.meters, 1.meters),
                blocks[2],
                OccupancySegment(0.0, 3600.0, 0.meters, 1.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[2], Offset(100.meters))))
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
        val infra = DummyInfra()
        val blocks = listOf(infra.addBlock("a", "b"))
        val occupancyGraph =
            ImmutableMultimap.of(blocks[0], OccupancySegment(300.0, 3600.0, 0.meters, 1.meters))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[0], Offset(100.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run()!!
        occupancyTest(res, occupancyGraph)
        assertTrue(res.departureTime < 300)
    }

    /** Tests that we can give a negative result when the infra contains a loop */
    @Test
    fun infraWithLoop() {
        /*
        a --> b --> c       x --> y
        ^           v
        +-----------+

        The blocks are very long, to test that it works even with large time differences

         */
        val infra = DummyInfra()
        infra.addBlock("a", "b", 10000.meters)
        infra.addBlock("b", "c", 10000.meters)
        infra.addBlock("c", "a", 10000.meters)
        infra.addBlock("x", "y")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(
                    setOf(
                        EdgeLocation(
                            BlockId(infra.getRouteFromName("a->b").index),
                            Offset(0.meters)
                        )
                    )
                )
                .setEndLocations(
                    setOf(
                        EdgeLocation(
                            BlockId(infra.getRouteFromName("x->y").index),
                            Offset(0.meters)
                        )
                    )
                )
                .run()
        Assertions.assertNull(res)
    }
    /** Start and end are on the same block, but reversed */
    @Test
    fun singleBlockReversed() {
        /*
        a --> b
         */
        val infra = DummyInfra()
        val block = infra.addBlock("a", "b")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(block, Offset(42.meters))))
                .setEndLocations(setOf(EdgeLocation(block, Offset(21.meters))))
                .run()
        assertNull(res)
    }
}
