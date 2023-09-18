package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.SPEED_EPSILON;
import static fr.sncf.osrd.stdcm.STDCMHelpers.m;
import static fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest;
import static fr.sncf.osrd.stdcm.StandardAllowanceTests.checkAllowanceResult;
import static fr.sncf.osrd.stdcm.StandardAllowanceTests.runWithAndWithoutAllowance;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.DummyInfra;
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
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var secondBlock = infra.addBlock("b", "c");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, m(50))), 10_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, m(100))), 0, true))
                .run();
        assertNotNull(res);
        double expectedOffset = 150;

        // Check that we stop
        assertEquals(0, res.envelope().interpolateSpeed(expectedOffset), SPEED_EPSILON);

        // Check that the stop is properly returned
        assertEquals(
                List.of(
                        new TrainStop(m(expectedOffset), 10_000)
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
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var secondBlock = infra.addBlock("b", "c");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 0)), 10_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, m(100))), 0, true))
                .run();
        assertNotNull(res);
        checkStop(res, List.of(
                new TrainStop(m(100), 10_000)
        ));
    }

    /** Look for a path in an empty timetable, with a stop at the end of a block */
    @Test
    public void emptyTimetableWithStopBlockEnd() {
        /*
        a --> b --> c
         */
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var secondBlock = infra.addBlock("b", "c");
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, m(100))), 10_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, m(100))), 0, true))
                .run();
        assertNotNull(res);
        checkStop(res, List.of(
                new TrainStop(m(100), 10_000)
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
        var infra = DummyInfra.make();
        var blocksDirectPath = List.of(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d"),
                infra.addBlock("d", "e")
        );
        var detour = List.of(
                infra.addBlock("b", "x", m(100_000)),
                infra.addBlock("x", "d", m(100_000))
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartTime(100)
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocksDirectPath.get(0), 0)), 0, false))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(detour.get(1), m(1_000))), 0, stop))
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
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b");
        var secondBlock = infra.addBlock("b", "c");
        var unavailableTimes = ImmutableMultimap.of(
                secondBlock, new OccupancySegment(100_000, POSITIVE_INFINITY, 0, m(100))
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, m(10))), 100_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, m(100))), 0, true))
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
        var infra = DummyInfra.make();
        var blocks = List.of(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d", m(1))
        );
        var occupancy = ImmutableMultimap.of(
                blocks.get(2), new OccupancySegment(0, 12_000, 0, m(1)),
                blocks.get(2), new OccupancySegment(12_010, POSITIVE_INFINITY, 0, m(1))
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), m(50))), 10_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), m(1))), 0, true))
                .setUnavailableTimes(occupancy)
                .run();
        assertNotNull(res);
        checkStop(res, List.of(
                new TrainStop(m(50), 10_000)
        ));
        occupancyTest(res, occupancy);
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

        var infra = DummyInfra.make();
        var blocks = List.of(
                infra.addBlock("a", "b", m(1), 20),
                infra.addBlock("b", "c", m(1_000), 20),
                infra.addBlock("c", "d", m(100), 20),
                infra.addBlock("d", "e", m(1), 20)
        );
        var occupancy = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(10, POSITIVE_INFINITY, 0, m(1)),
                blocks.get(3), new OccupancySegment(0, 1_200, 0, m(1)),
                blocks.get(3), new OccupancySegment(1_220, POSITIVE_INFINITY, 0, m(1))
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(1), m(50))), 1_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(3), m(1))), 0, true))
                .run();
        assertNotNull(res);
        checkStop(res, List.of(
                new TrainStop(m(51), 1_000)
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

        var infra = DummyInfra.make();
        var blocks = List.of(
                infra.addBlock("a", "b", m(1), 20),
                infra.addBlock("b", "c", m(1_000), 20),
                infra.addBlock("c", "d", m(100), 20),
                infra.addBlock("d", "e", m(1), 20)
        );
        var occupancy = ImmutableMultimap.of(
                blocks.get(3), new OccupancySegment(0, 1_200, 0, m(1)),
                blocks.get(3), new OccupancySegment(1_220, POSITIVE_INFINITY, 0, m(1))
        );
        double timeStep = 2;
        var allowance = new AllowanceValue.Percentage(20);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .setStandardAllowance(allowance)
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(1), m(50))), 1_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(3), m(1))), 0, true))
        );
        assertNotNull(res);
        var expectedStops = List.of(
                new TrainStop(m(51), 1_000)
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

        var infra = DummyInfra.make();
        var blocks = List.of(
                infra.addBlock("a", "b", m(1), 20),
                infra.addBlock("b", "c", m(1_000), 20),
                infra.addBlock("c", "d", m(100), 20),
                infra.addBlock("d", "e", m(1), 20)
        );
        var occupancy = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(10, POSITIVE_INFINITY, 0, m(1)),
                blocks.get(3), new OccupancySegment(0, 1_200, 0, m(1)),
                blocks.get(3), new OccupancySegment(1_300, POSITIVE_INFINITY, 0, m(1))
        );
        double timeStep = 2;
        var allowance = new AllowanceValue.Percentage(20);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setUnavailableTimes(occupancy)
                .setTimeStep(timeStep)
                .setStandardAllowance(allowance)
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)), 0, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(1), m(50))), 1_000, true))
                .addStep(new STDCMStep(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(3), m(1))), 0, true))
        );
        assertNotNull(res);
        var expectedStops = List.of(
                new TrainStop(m(51), 1_000)
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
