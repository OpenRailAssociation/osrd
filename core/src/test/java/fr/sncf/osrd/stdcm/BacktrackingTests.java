package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.stdcm.graph.STDCMSimulations;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class BacktrackingTests {

    /** This test requires some backtracking to compute the final braking curve.
     * With a naive approach we reach the destination in time, but the extra braking curve makes us
     * reach the next block */
    @Test
    public void testBacktrackingBrakingCurve() {
        /*
        a ------> b
         */
        var infraBuilder = new DummyInfraBuilder();
        var block = infraBuilder.addBlock("a", "b", 1000);
        var firstBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                block, 0, 0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert firstBlockEnvelope != null;
        var runTime = firstBlockEnvelope.getTotalTime();
        var occupancyGraph = ImmutableMultimap.of(
                block, new OccupancySegment(runTime + 1, POSITIVE_INFINITY, 0, 1000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(block, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(block, 1_000)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        if (res == null)
            return;
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** This is the same test as the one above, but with the braking curve spanning over several blocks */
    @Test
    public void testBacktrackingBrakingCurveSeveralBlocks() {
        /*
        a ------> b -> c -> d -> e
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 1000);
        infraBuilder.addBlock("b", "c", 10);
        infraBuilder.addBlock("c", "d", 10);
        var lastBlock = infraBuilder.addBlock("d", "e", 10);
        var firstBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                firstBlock, 0, 0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert firstBlockEnvelope != null;
        var runTime = firstBlockEnvelope.getTotalTime();
        var occupancyGraph = ImmutableMultimap.of(
                lastBlock, new OccupancySegment(runTime + 10, POSITIVE_INFINITY, 0, 10)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, 5)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        if (res == null)
            return;
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** Test that we don't stay in the first block for too long when there is an MRSP drop at the block transition */
    @Test
    public void testBacktrackingMRSPDrop() {
        /*
        a ------> b -> c
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 1000);
        var secondBlock = infraBuilder.addBlock("b", "c", 100, 5);
        var firstBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                firstBlock, 0, 0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert firstBlockEnvelope != null;
        var runTime = firstBlockEnvelope.getTotalTime();
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(runTime + 10, POSITIVE_INFINITY, 0, 1000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 5)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        if (res == null)
            return;
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** Test that we can backtrack several times over the same edges */
    @Test
    public void testManyBacktracking() {
        /*
        a ------> b -> c -> d -> e ----> f

        Long first block for speedup, then the MRSP drops at each (short) block
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 10000);
        infraBuilder.addBlock("b", "c", 10, 20);
        infraBuilder.addBlock("c", "d", 10, 15);
        infraBuilder.addBlock("d", "e", 10, 10);
        var lastBlock = infraBuilder.addBlock("e", "f", 1000, 5);
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, 1_000)))
                .run();
        assert res != null;
        assertTrue(res.envelope().continuous);
    }
}
