package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.stdcm.STDCMHelpers.meters;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.*;
import fr.sncf.osrd.utils.DummyInfra;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class STDCMPathfindingTests {

    /** Look for a path in an empty timetable */
    @Test
    public void emptyTimetable() {
        /*
        a --> b --> c
         */
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var secondBlock = infra.addBlock("b", "c");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, meters(50))))
                .run();
        assertNotNull(res);
    }

    /** Look for a path where the blocks are occupied before and after */
    @Test
    public void betweenTrains() {
        /*
        a --> b --> c
         */
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var secondBlock = infra.addBlock("b", "c");
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(0, 50, 0, meters(100)),
                firstBlock, new OccupancySegment(10000, POSITIVE_INFINITY, 0, meters(100)),
                secondBlock, new OccupancySegment(0, 50, 0, meters(100)),
                secondBlock, new OccupancySegment(10000, POSITIVE_INFINITY, 0, meters(100)));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, meters(50))))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
    }

    /** Test that no path is found when the blocks aren't connected */
    @Test
    public void disconnectedBlocks() {
        /*
        a --> b

        x --> y
         */
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var secondBlock = infra.addBlock("x", "y");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 0)))
                .run();
        assertNull(res);
    }

    /** Test that no path is found if the first block is free for a very short interval */
    @Test
    public void impossiblePath() {
        /*
        a --> b --> c
         */
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var secondBlock = infra.addBlock("b", "c");
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(0, 99, 0, meters(100)),
                firstBlock, new OccupancySegment(101, POSITIVE_INFINITY, 0, meters(100)),
                secondBlock, new OccupancySegment(0, 50, 0, meters(100)),
                secondBlock, new OccupancySegment(1000, POSITIVE_INFINITY, 0, meters(100)));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, meters(50))))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNull(res);

    }

    /** Test that we can find a path even if the last block is occupied when the train starts */
    @Test
    public void lastBlockOccupiedAtStart() {
        /*
        a ------> b --> c
         */
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b", meters(1000));
        var secondBlock = infra.addBlock("b", "c");
        var occupancyGraph = ImmutableMultimap.of(
                secondBlock, new OccupancySegment(0, 10, 0, meters(100))
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, meters(50))))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
    }

    /** Test that the path can change depending on the occupancy */
    @Test
    public void testAvoidBlockedBlocks() {
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
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var blockTop = infra.addBlock("b", "c1");
        var blockBottom = infra.addBlock("b", "c2");
        infra.addBlock("c1", "d");
        infra.addBlock("c2", "d");
        var lastBlock = infra.addBlock("d", "e");
        var occupancyGraph1 = ImmutableMultimap.of(
                blockTop, new OccupancySegment(0, POSITIVE_INFINITY, 0, meters(100))
        );
        var occupancyGraph2 = ImmutableMultimap.of(
                blockBottom, new OccupancySegment(0, POSITIVE_INFINITY, 0, meters(100))
        );

        var res1 = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, meters(50))))
                .setUnavailableTimes(occupancyGraph1)
                .run();
        var res2 = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, meters(50))))
                .setUnavailableTimes(occupancyGraph2)
                .run();
        assertNotNull(res1);
        assertNotNull(res2);
        /* FIXME
        final var blocks1 = res1.blocks().ranges().stream()
                .map(block -> block.edge().getInfraBlock().getID()).toList();
        final var blocks2 = res2.blocks().ranges().stream()
                .map(block -> block.edge().getInfraBlock().getID()).toList();

        assertFalse(blocks1.contains("b->c1"));
        assertTrue(blocks1.contains("b->c2"));
        STDCMHelpers.occupancyTest(res1, occupancyGraph1);

        assertFalse(blocks2.contains("b->c2"));
        assertTrue(blocks2.contains("b->c1"));
        STDCMHelpers.occupancyTest(res2, occupancyGraph2);
         */
    }

    /** Test that everything works well when the train is at max speed during block transitions */
    @Test
    public void veryLongPathTest() {
        /*
        a ------> b -----> c ------> d
         */
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b", meters(10000));
        infra.addBlock("b", "c", meters(10000));
        var lastBlock = infra.addBlock("c", "d", meters(10000));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, meters(9000))))
                .run();
        assertNotNull(res);
    }

    /** Test that we avoid a path that the train can't use because of a high slope */
    @Test
    public void testAvoidImpossiblePath() {
        /*
                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        infra.addBlock("b", "c1");
        infra.addBlock("b", "c2");
        var blockTop = infra.addBlock("c1", "d");
        infra.addBlock("c2", "d");
        var lastBlock = infra.addBlock("d", "e");

        // FIXME: add gradients to blockTop (or drop this test)

        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, meters(50))))
                .run();
        assertNotNull(res);
    }

    /** Test that we don't enter infinite loops */
    @Test
    public void testImpossiblePathWithLoop() {
        /*
        a --> b
        ^----/

        x --> y
         */
        var infra = DummyInfra.make();
        var firstLoop = infra.addBlock("a", "b");
        infra.addBlock("b", "a");
        var disconnectedBlock = infra.addBlock("x", "y");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstLoop, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(disconnectedBlock, 0)))
                .run();
        assertNull(res);
    }

    /** Test that we check that the total run time doesn't exceed the threshold if it happens after the edge start */
    @Test
    public void testTotalRunTimeLongEdge() {
        /*
        a ---------> b
         */
        var infra = DummyInfra.make();
        var block = infra.addBlock("a", "b", meters(10_000));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(block, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(block, meters(10_000))))
                .setMaxRunTime(100)
                .run();
        assertNull(res);
    }

    /** Test that we check that the total run time doesn't exceed the threshold with many small edges */
    @Test
    public void testTotalRunTimeShortEdges() {
        /*
        1 --> 2 --> ... --> 10
         */
        var infra = DummyInfra.make();
        var blocks = new ArrayList<Integer>();
        for (int i = 0; i < 10; i++)
            blocks.add(infra.addBlock(Integer.toString(i + 1), Integer.toString(i + 2), meters(1000)));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(9), meters(1_000))))
                .setMaxRunTime(100)
                .run();
        assertNull(res);
    }

    /** Test that the start delay isn't included in the total run time */
    @Test
    public void testMaxRunTimeWithDelay() {
        /*
        a --> b
         */
        final double timeStep = 2;
        var infra = DummyInfra.make();
        var block = infra.addBlock("a", "b");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(block, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(block, meters(100))))
                .setUnavailableTimes(ImmutableMultimap.of(
                        block, new OccupancySegment(0, 1000, 0, meters(100))
                ))
                .setMaxDepartureDelay(1000 + timeStep)
                .setMaxRunTime(100)
                .setTimeStep(timeStep)
                .run();
        assertNotNull(res);
    }

    /** Test that we ignore occupancy that happen after the end goal */
    @Test
    public void testOccupancyEnvelopeLengthBlockSize() {
        /*
        a -(start) -> (end) ---------------[occupied]---------> b

        The block is occupied after the destination
         */
        var infra = DummyInfra.make();
        var block = infra.addBlock("a", "b", meters(100_000));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(block, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(block, meters(10))))
                .setUnavailableTimes(ImmutableMultimap.of(
                        block, new OccupancySegment(0, POSITIVE_INFINITY, meters(99_000), meters(100_000))
                ))
                .run();
        assertNotNull(res);
    }

    /** Test that we don't use the full block envelope when the destination is close to the start */
    @Test
    public void testOccupancyEnvelopeLength() {
        /*
        a -(start) -> (end) ------------------------> b

        The destination is reached early and the block is occupied after a while
         */
        var infra = DummyInfra.make();
        var block = infra.addBlock("a", "b", meters(100_000));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(block, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(block, meters(10))))
                .setUnavailableTimes(ImmutableMultimap.of(
                        block, new OccupancySegment(300, POSITIVE_INFINITY, 0, meters(100_000))
                ))
                .run();
        assertNotNull(res);
    }

    /** Test that we can visit the same "opening" several times at very different times */
    @Test
    public void testVisitSameOpeningDifferentTimes() {
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
        var infra = DummyInfra.make();
        var blocks = List.of(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d")
        );
        var runTime = STDCMHelpers.getBlocksRunTime(infra.fullInfra(), blocks);
        var occupancyGraph = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(300, 3600, 0, meters(1)),
                blocks.get(2), new OccupancySegment(0, 3600, 0, meters(1))
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), meters(100))))
                .setUnavailableTimes(occupancyGraph)
                .setMaxRunTime(runTime + 60) // We add a margin for the stop time
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
    }

    /** Test that we return the earliest path among the fastest ones*/
    @Test
    public void testReturnTheEarliestOfTheFastestPaths() {
        /*
        a --> b

        space
          ^     end     end
          |    /       /
        b |   /       /
          |  / ##### /  
        a |_/_ #####/________> time
         */
        var infra = DummyInfra.make();
        var blocks = List.of(infra.addBlock("a", "b"));
        var occupancyGraph = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(300, 3600, 0, meters(1))
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), meters(100))))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
        assertTrue(res.departureTime() < 300);
    }
  
}
