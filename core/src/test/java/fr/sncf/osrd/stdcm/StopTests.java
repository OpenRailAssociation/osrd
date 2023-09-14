package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.SPEED_EPSILON;
import static fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest;
import static fr.sncf.osrd.stdcm.StandardAllowanceTests.checkAllowanceResult;
import static fr.sncf.osrd.stdcm.StandardAllowanceTests.runWithAndWithoutAllowance;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.List;
import java.util.Set;

public class StopTests {
    /** Look for a path in an empty timetable, with a stop in the middle of a block */
    @Test
    public void emptyTimetableWithStop() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 50)), 10_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 100)), 0, true))
                .run();
        assertNotNull(res);
        double expectedOffset = 150;

        // Check that we stop
        assertEquals(0, res.envelope().interpolateSpeed(expectedOffset), SPEED_EPSILON);

        // Check that the stop is properly returned
        assertEquals(
                List.of(
                        new TrainStop(expectedOffset, 10_000)
                ),
                res.stopResults()
        );
    }

    /** Look for a path in an empty timetable, with a stop at the start of a block */
    @Test
    public void emptyTimetableWithStopBlockStart() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 0)), 10_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 100)), 0, true))
                .run();
        assertNotNull(res);
        checkStop(res, List.of(
                new TrainStop(100, 10_000)
        ));
    }

    /** Look for a path in an empty timetable, with a stop at the end of a block */
    @Test
    public void emptyTimetableWithStopBlockEnd() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 100)), 10_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 100)), 0, true))
                .run();
        assertNotNull(res);
        checkStop(res, List.of(
                new TrainStop(100, 10_000)
        ));
    }

    /** Checks that we can make a detour to pass by an intermediate step */
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    public void detourForStep(boolean stop) {
        /*
        a --> b --> c --> d --> e
               \         ^
                \       /
                 \     /
                  \   /
                   v /
                    x
         */
        var infraBuilder = new DummyInfraBuilder();
        var blocksDirectPath = List.of(
                infraBuilder.addBlock("a", "b"),
                infraBuilder.addBlock("b", "c"),
                infraBuilder.addBlock("c", "d"),
                infraBuilder.addBlock("d", "e")
        );
        var detour = List.of(
                infraBuilder.addBlock("b", "x", 100_000),
                infraBuilder.addBlock("x", "d", 100_000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartTime(100)
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocksDirectPath.get(0), 0)), 0, false))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(detour.get(1), 1_000)), 0, stop))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocksDirectPath.get(3), 0)), 0, true))
                .run();
        assertNotNull(res);
        /* FIXME
        var blocks = res.blocks().ranges().stream()
                .map(block -> block.edge().getInfraBlock().getID()).toList();
        assertEquals(
                List.of(
                        "a->b",
                        "b->x",
                        "x->d",
                        "d->e"
                ), blocks
        );
         */
        assertNotEquals(stop, res.stopResults().isEmpty());
        assertEquals(stop, res.envelope().interpolateSpeed(101_100) == 0);
    }

    /** Test that the stop time is properly accounted for, by making the train stop for too long to find a solution */
    @Test
    public void testImpossibleSolutionBecauseOfStop() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var unavailableTimes = ImmutableMultimap.of(
                secondBlock, new OccupancySegment(100_000, POSITIVE_INFINITY, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 10)), 100_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 100)), 0, true))
                .setUnavailableTimes(unavailableTimes)
                .run();
        assertNull(res);
    }

    /** Checks that we add the right amount of delay with a stop */
    @Test
    public void delayWithStop() {
        /*
        a --> b --> c -> d
         */
        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b"),
                infraBuilder.addBlock("b", "c"),
                infraBuilder.addBlock("c", "d", 1)
        );
        var occupancy = ImmutableMultimap.of(
                blocks.get(2), new OccupancySegment(0, 12_000, 0, 1),
                blocks.get(2), new OccupancySegment(12_010, POSITIVE_INFINITY, 0, 1)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 50)), 10_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), 1)), 0, true))
                .setUnavailableTimes(occupancy)
                .run();
        assertNotNull(res);
        checkStop(res, List.of(
                new TrainStop(50, 10_000)
        ));
        occupancyTest(infraBuilder.fullInfra(), res, occupancy);
    }

    /** Checks that we can handle engineering allowance with a stop */
    @Test
    public void engineeringAllowanceWithStops() {
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

        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1, 20),
                infraBuilder.addBlock("b", "c", 1_000, 20),
                infraBuilder.addBlock("c", "d", 100, 20),
                infraBuilder.addBlock("d", "e", 1, 20)
        );
        var occupancy = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(10, POSITIVE_INFINITY, 0, 1),
                blocks.get(3), new OccupancySegment(0, 1_200, 0, 1),
                blocks.get(3), new OccupancySegment(1_220, POSITIVE_INFINITY, 0, 1)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(1), 50)), 1_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(3), 1)), 0, true))
                .run();
        assertNotNull(res);
        checkStop(res, List.of(
                new TrainStop(51, 1_000)
        ));
        occupancyTest(res, occupancy, 2 * timeStep);
    }

    /** Checks that we can handle a standard allowance with a stop */
    @Test
    public void standardAllowanceWithStops() {
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

        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1, 20),
                infraBuilder.addBlock("b", "c", 1_000, 20),
                infraBuilder.addBlock("c", "d", 100, 20),
                infraBuilder.addBlock("d", "e", 1, 20)
        );
        var occupancy = ImmutableMultimap.of(
                blocks.get(3), new OccupancySegment(0, 1_200, 0, 1),
                blocks.get(3), new OccupancySegment(1_220, POSITIVE_INFINITY, 0, 1)
        );
        double timeStep = 2;
        var allowance = new AllowanceValue.Percentage(20);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .setStandardAllowance(allowance)
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(1), 50)), 1_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(3), 1)), 0, true))
        );
        assertNotNull(res);
        var expectedStops = List.of(
                new TrainStop(51, 1_000)
        );
        checkStop(res.withAllowance(), expectedStops);
        checkStop(res.withoutAllowance(), expectedStops);
        occupancyTest(res.withAllowance(), occupancy, 2 * timeStep);
        occupancyTest(res.withoutAllowance(), occupancy, 2 * timeStep);
        checkAllowanceResult(res, allowance, 4 * timeStep);
    }

    /** Checks that we can handle both a standard and engineering allowance with a stop */
    @Test
    public void standardAndEngineeringAllowanceWithStops() {
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

        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1, 20),
                infraBuilder.addBlock("b", "c", 1_000, 20),
                infraBuilder.addBlock("c", "d", 100, 20),
                infraBuilder.addBlock("d", "e", 1, 20)
        );
        var occupancy = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(10, POSITIVE_INFINITY, 0, 1),
                blocks.get(3), new OccupancySegment(0, 1_200, 0, 1),
                blocks.get(3), new OccupancySegment(1_300, POSITIVE_INFINITY, 0, 1)
        );
        double timeStep = 2;
        var allowance = new AllowanceValue.Percentage(20);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .setStandardAllowance(allowance)
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(1), 50)), 1_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(3), 1)), 0, true))
        );
        assertNotNull(res);
        var expectedStops = List.of(
                new TrainStop(51, 1_000)
        );
        checkStop(res.withAllowance(), expectedStops);
        checkStop(res.withoutAllowance(), expectedStops);
        occupancyTest(res.withAllowance(), occupancy, 2 * timeStep);
        occupancyTest(res.withoutAllowance(), occupancy, 2 * timeStep);
    }

    /** Check that the train actually stops at the expected times and positions */
    private static void checkStop(STDCMResult res, List<TrainStop> expectedStops) {
        // Check that the stops are properly returned
        assertEquals(
                expectedStops,
                res.stopResults()
        );

        // Check that we stop
        for (var stop : expectedStops)
            assertEquals(0, res.envelope().interpolateSpeed(stop.position), SPEED_EPSILON);
    }
}
