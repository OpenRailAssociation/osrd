package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.stdcm.graph.STDCMSimulations;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;

public class EngineeringAllowanceTests {

    /** Test that we can add an engineering allowance to avoid an occupied section */
    @Test
    public void testSlowdown() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 1_000, 30);
        var secondBlock = infraBuilder.addBlock("b", "c", 10_000, 30);
        var thirdBlock = infraBuilder.addBlock("c", "d", 100, 30);
        var firstBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                firstBlock, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert firstBlockEnvelope != null;
        var secondBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                secondBlock, firstBlockEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert secondBlockEnvelope != null;
        var timeThirdBlockFree = firstBlockEnvelope.getTotalTime() + secondBlockEnvelope.getTotalTime();
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(firstBlockEnvelope.getTotalTime() + 10, POSITIVE_INFINITY,
                        0, 1_000),
                thirdBlock, new OccupancySegment(0, timeThirdBlockFree + 30, 0, 100)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdBlock, 1)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph, 2 * timeStep);
    }

    /** Test that we can add an engineering allowance over several blocks to avoid an occupied section */
    @Test
    public void testSlowdownSeveralBlocks() {
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
        final double timeStep = 2;
        final var infraBuilder = new DummyInfraBuilder();
        final var firstBlock = infraBuilder.addBlock("a", "b", 1_000, 20);
        final var secondBlock = infraBuilder.addBlock("b", "c", 1_000, 20);
        infraBuilder.addBlock("c", "d", 1_000, 20);
        infraBuilder.addBlock("d", "e", 1_000, 20);
        var lastBlock = infraBuilder.addBlock("e", "f", 1_000, 20);
        var firstBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                firstBlock, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert firstBlockEnvelope != null;
        var secondBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                secondBlock, firstBlockEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert secondBlockEnvelope != null;
        var timeLastBlockFree = firstBlockEnvelope.getTotalTime() + 120 + secondBlockEnvelope.getTotalTime() * 3;
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(firstBlockEnvelope.getTotalTime() + timeStep,
                        POSITIVE_INFINITY, 0, 1_000),
                lastBlock, new OccupancySegment(0, timeLastBlockFree, 0, 1_000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, 1_000)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph, 2 * timeStep);
        assertEquals(0, res.departureTime(), 2 * timeStep);
    }

    /** Test that allowances don't cause new conflicts */
    @Test
    public void testSlowdownWithConflicts() {
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
        final double timeStep = 2;
        final var infraBuilder = new DummyInfraBuilder();
        final var firstBlock = infraBuilder.addBlock("a", "b", 1_000, 20);
        final var secondBlock = infraBuilder.addBlock("b", "c", 1_000, 20);
        final var thirdBlock = infraBuilder.addBlock("c", "d", 1_000, 20);
        infraBuilder.addBlock("d", "e", 1_000, 20);
        var lastBlock = infraBuilder.addBlock("e", "f", 1_000, 20);
        var firstBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                firstBlock, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert firstBlockEnvelope != null;
        var secondBlockEnvelope = STDCMSimulations.simulateBlock(infraBuilder.rawInfra, infraBuilder.blockInfra,
                secondBlock, firstBlockEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
        assert secondBlockEnvelope != null;
        var timeLastBlockFree = firstBlockEnvelope.getTotalTime() + 120 + secondBlockEnvelope.getTotalTime() * 3;
        var timeThirdBlockOccupied = firstBlockEnvelope.getTotalTime() + 5 + secondBlockEnvelope.getTotalTime() * 2;
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(firstBlockEnvelope.getTotalTime() + timeStep,
                        POSITIVE_INFINITY, 0, 1_000),
                lastBlock, new OccupancySegment(0, timeLastBlockFree, 0, 1_000),
                thirdBlock, new OccupancySegment(timeThirdBlockOccupied, POSITIVE_INFINITY, 0, 1_000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastBlock, 1_000)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph, 2 * timeStep);
        assertEquals(0, res.departureTime(), 2 * timeStep);
    }

    /** Test that we can add the max delay by shifting the departure time, then add more delay by slowing down */
    @Test
    public void testMaxDepartureTimeShift() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 1_000, 30);
        var secondBlock = infraBuilder.addBlock("b", "c", 1_000, 30);
        var thirdBlock = infraBuilder.addBlock("c", "d", 1, 30);
        var lastBlockEntryTime = STDCMHelpers.getBlocksRunTime(infraBuilder.fullInfra(),
                List.of(firstBlock, secondBlock));
        var timeThirdBlockFree = lastBlockEntryTime + 3600 * 2 + 60;
        var occupancyGraph = ImmutableMultimap.of(
                thirdBlock, new OccupancySegment(0, timeThirdBlockFree, 0, 1)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdBlock, 1)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
        assertEquals(3600 * 2, res.departureTime(), 2 * timeStep);
        assertTrue(res.departureTime() <= 3600 * 2);
    }

    /** The allowance happens in an area where we have added delay by shifting the departure time */
    @Test
    public void testAllowanceWithDepartureTimeShift() {
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
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 2_000, 20);
        var secondBlock = infraBuilder.addBlock("b", "c", 2_000, 20);
        var thirdBlock = infraBuilder.addBlock("c", "d", 2_000, 20);
        var forthBlock = infraBuilder.addBlock("d", "e", 2_000, 20);
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(0, 600, 0, 100),
                firstBlock, new OccupancySegment(2_000, POSITIVE_INFINITY, 0, 100),
                secondBlock, new OccupancySegment(0, 1200, 0, 100),
                thirdBlock, new OccupancySegment(0, 1800, 0, 100),
                forthBlock, new OccupancySegment(0, 4_000, 0, 100)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthBlock, 1)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();
        assertNotNull(res);
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph, 2 * timeStep);
    }

    /** Test that we return null with no crash when we can't slow down fast enough */
    @Test
    public void testImpossibleEngineeringAllowance() {
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
        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1_000),
                infraBuilder.addBlock("b", "c", 1),
                infraBuilder.addBlock("c", "d", 1_000)
        );
        var occupancyGraph = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(300, POSITIVE_INFINITY, 0, 1_000),
                blocks.get(2), new OccupancySegment(0, 3600, 0, 1_000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), 1_000)))
                .setUnavailableTimes(occupancyGraph)
                .setMaxDepartureDelay(POSITIVE_INFINITY)
                .run();

        assertNull(res);
    }

    /** Test that we return the fastest path even if there are some engineering allowances*/
    @Test
    public void testReturnTheFastestPathWithAllowance() {
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
        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b"),
                infraBuilder.addBlock("b", "c"),
                infraBuilder.addBlock("c", "d")
        );
        var occupancyGraph = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(300, 3600, 0, 1),
                blocks.get(2), new OccupancySegment(0, 3600, 0, 1)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), 100)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph);
        assertEquals(3600, res.departureTime(), timeStep);
    }
}
