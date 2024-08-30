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

class BacktrackingTests {
    /**
     * This test requires some backtracking to compute the final braking curve. With a naive
     * approach we reach the destination in time, but the extra braking curve makes us reach the
     * next block
     */
    @Test
    fun testBacktrackingBrakingCurve() {
        /*
        a ------> b
         */
        val infra = DummyInfra()
        val block = infra.addBlock("a", "b", 1000.meters)
        val firstBlockEnvelope =
            simulateBlock(
                infra,
                infraExplorerFromBlock(infra, infra, block),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null
            )!!
        val runTime = firstBlockEnvelope.totalTime
        val occupancyGraph =
            ImmutableMultimap.of(
                block,
                OccupancySegment(runTime + 1, Double.POSITIVE_INFINITY, 0.meters, 1000.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(block, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(block, Offset<Block>(1000.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run() ?: return
        occupancyTest(res, occupancyGraph)
    }

    /**
     * This is the same test as the one above, but with the braking curve spanning over several
     * blocks
     */
    @Test
    fun testBacktrackingBrakingCurveSeveralBlocks() {
        /*
        a ------> b -> c -> d -> e
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        infra.addBlock("b", "c", 10.meters)
        infra.addBlock("c", "d", 10.meters)
        val lastBlock = infra.addBlock("d", "e", 10.meters)
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
        val runTime = firstBlockEnvelope.totalTime
        val occupancyGraph =
            ImmutableMultimap.of(
                lastBlock,
                OccupancySegment(runTime + 10, Double.POSITIVE_INFINITY, 0.meters, 10.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset<Block>(5.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run() ?: return
        occupancyTest(res, occupancyGraph)
    }

    /**
     * Test that we don't stay in the first block for too long when there is an MRSP drop at the
     * block transition
     */
    @Test
    fun testBacktrackingMRSPDrop() {
        /*
        a ------> b -> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        val secondBlock = infra.addBlock("b", "c", 100.meters, 5.0)
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
        val runTime = firstBlockEnvelope.totalTime
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(runTime + 10, Double.POSITIVE_INFINITY, 0.meters, 1000.meters)
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset<Block>(5.meters))))
                .setUnavailableTimes(occupancyGraph)
                .run() ?: return
        occupancyTest(res, occupancyGraph)
    }

    /** Test that we can backtrack several times over the same edges */
    @Test
    fun testManyBacktracking() {
        /*
        a ------> b -> c -> d -> e ----> f

        Long first block for speedup, then the MRSP drops at each (short) block
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 10000.meters)
        infra.addBlock("b", "c", 10.meters, 20.0)
        infra.addBlock("c", "d", 10.meters, 15.0)
        infra.addBlock("d", "e", 10.meters, 10.0)
        val lastBlock = infra.addBlock("e", "f", 1000.meters, 5.0)
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(lastBlock, Offset<Block>(1000.meters))))
                .run()!!
        Assertions.assertTrue(res.envelope.continuous)
    }
}
