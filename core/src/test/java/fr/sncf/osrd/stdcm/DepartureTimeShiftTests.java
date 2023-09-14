package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.stdcm.graph.STDCMSimulations;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class DepartureTimeShiftTests {

    /** Test that we can add delays to avoid occupied sections */
    @Test
    public void testSimpleDelay() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var occupancyGraph = ImmutableMultimap.of(
                secondBlock, new OccupancySegment(0, 3600, 0, 100)
        );

        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 50)))
                .run();
        assertNotNull(res);
        var secondBlockEntryTime = res.departureTime()
                + res.envelope().interpolateTotalTime(infraBuilder.blockInfra.getBlockLength(firstBlock));
        assertTrue(secondBlockEntryTime >= 3600);
        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** Test that we can add delays to avoid several occupied blocks */
    @Test
    public void testSimpleSeveralBlocks() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var occupancyGraph = ImmutableMultimap.of(
                secondBlock, new OccupancySegment(0, 1200, 0, 100),
                secondBlock, new OccupancySegment(1200, 2400, 0, 100),
                secondBlock, new OccupancySegment(2400, 3600, 0, 100)
        );

        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 50)))
                .run();

        assertNotNull(res);
        var secondBlockEntryTime = res.departureTime()
                + res.envelope().interpolateTotalTime(infraBuilder.blockInfra.getBlockLength(firstBlock));
        assertTrue(secondBlockEntryTime >= 3600);

        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** Test that the path we find is the one with the earliest arrival time rather than the shortest */
    @Test
    public void testEarliestArrivalTime() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 1000);
        infraBuilder.addBlock("b", "c1", 50, 1);
        infraBuilder.addBlock("b", "c2");
        infraBuilder.addBlock("c1", "d", 50, 1);
        infraBuilder.addBlock("c2", "d");
        var lastBlock = infraBuilder.addBlock("d", "e", 1000);

        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, 1000)))
                .run();

        assertNotNull(res);
        /* FIXME: figure out how to compare block "name"
        var blocks = res.blocks().ranges().stream()
                .map(edgeRange -> edgeRange.edge().getInfraBlock().getID())
                .collect(Collectors.toSet());
        assertTrue(blocks.contains("b->c2"));
        assertTrue(blocks.contains("c2->d"));
        assertFalse(blocks.contains("b->c1"));
        assertFalse(blocks.contains("c1->d"));
         */
    }

    /** Test that the path we find is the one with the earliest arrival time rather than the shortest
     * while taking into account departure time delay caused by the first block occupancy */
    @Test
    public void testEarliestArrivalTimeWithOccupancy() {
        /*
        Bop path is shorter but is occupied at start
        Tot path is longer but can be used with no delay
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 1000);
        infraBuilder.addBlock("b", "c1");
        var delayedBlock = infraBuilder.addBlock("b", "c2", 50);
        infraBuilder.addBlock("c1", "d");
        infraBuilder.addBlock("c2", "d");
        var lastBlock = infraBuilder.addBlock("d", "e", 1000);

        var occupancyGraph = ImmutableMultimap.of(delayedBlock, new OccupancySegment(
                0,
                10000,
                0,
                50)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, 1000)))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        /*
        var blocks = res.blocks().ranges().stream()
                .map(edgeRange -> edgeRange.edge().getInfraBlock().getID())
                .collect(Collectors.toSet());
        assertTrue(blocks.contains("b->c1"));
        assertTrue(blocks.contains("c1->d"));
        assertFalse(blocks.contains("b->c2"));
        assertFalse(blocks.contains("c2->d"));
         */
    }

    /** Test that we don't add too much delay, crossing over occupied sections in previous blocks */
    @Test
    public void testImpossibleAddedDelay() {
        /*
        a --> b --> c --> d
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var firstBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                firstBlock, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2, null, null);
        assert firstBlockEnvelope != null;
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(
                        firstBlockEnvelope.getTotalTime() + 10,
                        POSITIVE_INFINITY,
                        0, 100),
                secondBlock, new OccupancySegment(0, 3600, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 100)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNull(res);
    }

    /** Test that we can backtrack when the first "opening" doesn't lead to a valid solution.
     * To do this, we need to consider that the same block at different times can be different edges */
    @Test
    public void testDifferentOpenings() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var thirdBlock = infraBuilder.addBlock("c", "d");
        var occupancyGraph = ImmutableMultimap.of(
                secondBlock, new OccupancySegment(300, 500, 0, 100),
                thirdBlock, new OccupancySegment(0, 500, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdBlock, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** This is the same test as the one above, but with the split on the first block. */
    @Test
    public void testTwoOpeningsFirstBlock() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(300, 500, 0, 100),
                secondBlock, new OccupancySegment(0, 500, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** This is the same test as the one above, but with the split on the last block. */
    @Test
    public void testTwoOpeningsLastBlock() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var occupancyGraph = ImmutableMultimap.of(
                secondBlock, new OccupancySegment(300, 500, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 50)))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** Test that we keep track of how much we can shift the departure time over several blocks */
    @Test
    public void testMaximumShiftMoreRestrictive() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        infraBuilder.addBlock("c", "d", 1); // Very short to prevent slowdowns
        var forthBlock = infraBuilder.addBlock("d", "e");
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(1200, POSITIVE_INFINITY, 0, 100),
                secondBlock, new OccupancySegment(600, POSITIVE_INFINITY, 0, 100),
                forthBlock, new OccupancySegment(0, 1000, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthBlock, 1)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNull(res);
    }

    /** We shift de departure time a little more at each block,
     * we test that we still keep track of how much we can shift.
     * This test may need tweaking / removal once we consider slowdowns. */
    @Test
    public void testMaximumShiftWithDelays() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var thirdBlock = infraBuilder.addBlock("c", "d");
        var forthBlock = infraBuilder.addBlock("d", "e");
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(0, 200, 0, 100),
                firstBlock, new OccupancySegment(500, POSITIVE_INFINITY, 0, 100),
                secondBlock, new OccupancySegment(0, 400, 0, 100),
                thirdBlock, new OccupancySegment(0, 600, 0, 100),
                forthBlock, new OccupancySegment(0, 800, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthBlock, 1)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNull(res);
    }

    /** Test that we can consider more than two openings */
    @Test
    public void testSeveralOpenings() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var thirdBlock = infraBuilder.addBlock("c", "d");
        var occupancyGraph = ImmutableMultimap.of(
                secondBlock, new OccupancySegment(300, 600, 0, 100),
                secondBlock, new OccupancySegment(900, 1200, 0, 100),
                secondBlock, new OccupancySegment(1500, 1800, 0, 100),
                thirdBlock, new OccupancySegment(0, 1200, 0, 100),
                thirdBlock, new OccupancySegment(1500, POSITIVE_INFINITY, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdBlock, 1)))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
    }

    /** Test that we don't add more delay than specified */
    @Test
    public void testMaximumDepartureTimeDelay() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var lastBlock = infraBuilder.addBlock("b", "c");
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(0, 1000, 0, 100)
        );
        double timeStep = 2;
        var res1 = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, 0)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .setMaxDepartureDelay(1000 + timeStep)
                .run();
        assertNotNull(res1);

        var res2 = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, 0)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .setMaxDepartureDelay(1000 - timeStep)
                .run();
        assertNull(res2);
    }
}
