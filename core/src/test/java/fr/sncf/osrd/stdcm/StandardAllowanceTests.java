package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.stdcm.STDCMHelpers.occupancyTest;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class StandardAllowanceTests {

    private static final double timeStep = 2.;

    /** Contains result with and without allowance, with the method above it makes testing easier */
    record STDCMAllowanceResults(
            STDCMResult withAllowance,
            STDCMResult withoutAllowance
    ){}

    /** Runs the pathfinding with the given parameters, with and without allowance */
    static STDCMAllowanceResults runWithAndWithoutAllowance(STDCMPathfindingBuilder builder) {
        builder.setTimeStep(timeStep);
        var resultWithAllowance = builder.run();
        builder.setStandardAllowance(null);
        var resultWithoutAllowance = builder.run();
        return new STDCMAllowanceResults(
                resultWithAllowance,
                resultWithoutAllowance
        );
    }

    private static void checkAllowanceResult(STDCMAllowanceResults results, AllowanceValue value) {
        checkAllowanceResult(results, value, Double.NaN);
    }

    /** Compares the run time with and without allowance, checks that the allowance is properly applied */
    static void checkAllowanceResult(STDCMAllowanceResults results, AllowanceValue value, double tolerance) {
        if (Double.isNaN(tolerance))
            tolerance = 2 * timeStep;
        var baseEnvelope = results.withoutAllowance.envelope();
        var extraTime = value.getAllowanceTime(baseEnvelope.getTotalTime(), baseEnvelope.getTotalDistance());
        var baseTime = baseEnvelope.getTotalTime();
        var actualTime = results.withAllowance.envelope().getTotalTime();
        assertEquals(
                baseTime + extraTime,
                actualTime,
                tolerance
        );
    }


    /** Test that the path found with a simple allowance is longer than the path we find with no allowance */
    @Test
    public void testSimpleStandardAllowance() {
        /*
        a --> b --> c --> d
         */
        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1_000, 30),
                infraBuilder.addBlock("b", "c", 1_000, 30),
                infraBuilder.addBlock("c", "d", 1_000, 30)
        );
        var allowance = new AllowanceValue.Percentage(10);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), 1_000)))
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withAllowance);
        assertNotNull(res.withoutAllowance);
        checkAllowanceResult(res, allowance);
    }

    /** Same test as the previous one, with a very high allowance value (1000%) */
    @Test
    public void testVeryHighStandardAllowance() {
        /*
        a --> b --> c --> d
         */
        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1_000, 30),
                infraBuilder.addBlock("b", "c", 1_000, 30),
                infraBuilder.addBlock("c", "d", 1_000, 30)
        );
        var allowance = new AllowanceValue.Percentage(1_000);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), 1_000)))
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withAllowance);
        assertNotNull(res.withoutAllowance);
        checkAllowanceResult(res, allowance);
    }

    /** Test that we can add delays to avoid occupied sections with a standard allowance */
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
        var allowance = new AllowanceValue.Percentage(20);

        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondBlock, 50)))
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withoutAllowance);
        assertNotNull(res.withAllowance);
        var secondBlockEntryTime = res.withAllowance.departureTime()
                + res.withAllowance.envelope().interpolateTotalTime(infraBuilder.blockInfra.getBlockLength(firstBlock));
        assertTrue(secondBlockEntryTime >= 3600 - timeStep);
        occupancyTest(infraBuilder.fullInfra(), res.withAllowance, occupancyGraph, timeStep);
        checkAllowanceResult(res, allowance);
    }

    /** Test that we can add delays on partial block ranges with a standard allowance */
    @Test
    public void testBlockRangeOccupancy() {
        /*
        a ------> b

        The block is occupied from a certain point only, we check that we don't add too little or too much delay
         */
        var infraBuilder = new DummyInfraBuilder();
        var block = infraBuilder.addBlock("a", "b", 10_000);
        var occupancyGraph = ImmutableMultimap.of(
                block, new OccupancySegment(0, 3600, 5_000, 10_000)
        );
        var allowance = new AllowanceValue.Percentage(20);

        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(block, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(block, 10_000)))
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withoutAllowance);
        assertNotNull(res.withAllowance);
        var timeEnterOccupiedSection = res.withAllowance.departureTime()
                + res.withAllowance.envelope().interpolateTotalTime(5_000);
        assertEquals(3600, timeEnterOccupiedSection, 2 * timeStep);
        occupancyTest(infraBuilder.fullInfra(), res.withAllowance, occupancyGraph, 2 * timeStep);
        checkAllowanceResult(res, allowance);
    }

    /** Test that we can have both an engineering and a standard allowance */
    @Test
    public void testEngineeringWithStandardAllowance() {
        /*
        a --> b -----> c --> d

        space
          ^
        d |############### end
          |############### /
          |###############/
        c |           ___/
          |       ___/
        b |   ___/
          |  /#################
        a |_/##################_> time

         */
        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1_000, 30),
                infraBuilder.addBlock("b", "c", 10_000, 30),
                infraBuilder.addBlock("c", "d", 1_000, 30)
        );
        var occupancyGraph = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(120, POSITIVE_INFINITY, 0, 1_000),
                blocks.get(2), new OccupancySegment(0, 1000, 0, 1_000)
        );
        var allowance = new AllowanceValue.Percentage(20);

        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), 1_000)))
                .setStandardAllowance(allowance)
                .run();
        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph, timeStep);

        var thirdBlockEntryTime = res.departureTime()
                + res.envelope().interpolateTotalTime(11_000);
        assertEquals(1000, thirdBlockEntryTime, 4 * timeStep); // Errors build up, we need a high delta
    }

    /** Same test as the previous one, with very short blocks at the start and end */
    @Test
    public void testEngineeringWithStandardAllowanceSmallBlocks() {
        /*
        a -> b -----> c -> d

        space
          ^
        d |###############
          |############### end
        c |           ___/
          |       ___/
        b |   ___/
          |  /
        a |_/##################_> time

         */
        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1, 30),
                infraBuilder.addBlock("b", "c", 10_000, 30),
                infraBuilder.addBlock("c", "d", 1, 30)
        );
        var occupancyGraph = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(60, POSITIVE_INFINITY, 0, 1),
                blocks.get(2), new OccupancySegment(0, 1000, 0, 1)
        );
        var allowance = new AllowanceValue.Percentage(20);

        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), 1)))
                .setStandardAllowance(allowance)
                .run();
        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph, timeStep);

        var thirdBlockEntryTime = res.departureTime()
                + res.envelope().interpolateTotalTime(10_001);
        assertEquals(1000, thirdBlockEntryTime, 2 * timeStep);
    }


    /** This test checks that we add the right delay while backtracking several times, by adding mrsp drops */
    @Test
    public void testManyMRSPDrops() {
        var infraBuilder = new DummyInfraBuilder();
        var blocks = new ArrayList<Integer>();
        for (int i = 0; i < 10; i++) {
            blocks.add(infraBuilder.addBlock(
                    Integer.toString(i),
                    String.format("%d.5", i),
                    1_000,
                    50
            ));
            blocks.add(infraBuilder.addBlock(
                    String.format("%d.5", i),
                    Integer.toString(i + 1),
                    10,
                    5
            ));
        }
        var allowance = new AllowanceValue.Percentage(50);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(blocks.size() - 1), 0)))
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withAllowance);
        assertNotNull(res.withoutAllowance);
        checkAllowanceResult(res, allowance);
    }

    /** We shift de departure time a little more at each block */
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
        c |############# /    /         /
          |#############/____/_________/______________
        b |#####  /    /    /         /
          |#####/     /    /         /
        a start______/____/_________/__________________> time

         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var thirdBlock = infraBuilder.addBlock("c", "d");
        var forthBlock = infraBuilder.addBlock("d", "e");
        var allowance = new AllowanceValue.Percentage(100);
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(0, 200, 0, 100),
                secondBlock, new OccupancySegment(0, 600, 0, 100),
                thirdBlock, new OccupancySegment(0, 1200, 0, 100),
                forthBlock, new OccupancySegment(0, 2000, 0, 100)
        );
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthBlock, 1)))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withoutAllowance);
        assertNotNull(res.withAllowance);
        occupancyTest(infraBuilder.fullInfra(), res.withAllowance, occupancyGraph, timeStep);
        checkAllowanceResult(res, allowance);
    }

    /** Test that we can have both an engineering and a standard allowance, with a time per distance allowance */
    @Test
    public void testEngineeringWithStandardAllowanceTimePerDistance() {
        /*
        a --> b -----> c --> d

        space
          ^
        d |############### end
          |############### /
          |###############/
        c |           ___/
          |       ___/
        b |   ___/
          |  /#################
        a |_/##################_> time

         */
        var infraBuilder = new DummyInfraBuilder();
        var blocks = List.of(
                infraBuilder.addBlock("a", "b", 1_000, 30),
                infraBuilder.addBlock("b", "c", 10_000, 30),
                infraBuilder.addBlock("c", "d", 1_000, 30)
        );
        var occupancyGraph = ImmutableMultimap.of(
                blocks.get(0), new OccupancySegment(120, POSITIVE_INFINITY, 0, 1_000),
                blocks.get(2), new OccupancySegment(0, 1000, 0, 1_000)
        );
        var allowance = new AllowanceValue.TimePerDistance(60);

        var res = new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(2), 1_000)))
                .setStandardAllowance(allowance)
                .run();
        occupancyTest(infraBuilder.fullInfra(), res, occupancyGraph, timeStep);

        var thirdBlockEntryTime = res.departureTime()
                + res.envelope().interpolateTotalTime(11_000);
        assertEquals(1000, thirdBlockEntryTime, 2 * timeStep);
    }

    /** Tests a simple path with no conflict, with a time per distance allowance and very low value */
    @Test
    public void testSimplePathTimePerDistanceAllowanceLowValue() {
        /*
        a --> b --> c --> d --> e
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        infraBuilder.addBlock("b", "c");
        infraBuilder.addBlock("c", "d");
        var forthBlock = infraBuilder.addBlock("d", "e");
        var allowance = new AllowanceValue.TimePerDistance(1);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthBlock, 100)))
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withoutAllowance);
        assertNotNull(res.withAllowance);

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * timeStep);
    }

    /** Tests a simple path with no conflict, with a time per distance allowance */
    @Test
    public void testSimplePathTimePerDistanceAllowance() {
        /*
        a --> b --> c --> d --> e
         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        infraBuilder.addBlock("b", "c");
        infraBuilder.addBlock("c", "d");
        var forthBlock = infraBuilder.addBlock("d", "e");
        var allowance = new AllowanceValue.TimePerDistance(15);
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthBlock, 100)))
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withoutAllowance);
        assertNotNull(res.withAllowance);

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * timeStep);
    }

    /** We shift de departure time a little more at each block, with a time per distance allowance */
    @Test
    public void testMaximumShiftWithDelaysTimePerDistance() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        e |################################ end
          |################################/__________
        d |#################### /         /
          |####################/_________/____________
        c |############# /    /         /
          |#############/____/_________/______________
        b |#####  /    /    /         /
          |#####/     /    /         /
        a start______/____/_________/__________________> time

         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b");
        var secondBlock = infraBuilder.addBlock("b", "c");
        var thirdBlock = infraBuilder.addBlock("c", "d");
        var forthBlock = infraBuilder.addBlock("d", "e");
        var allowance = new AllowanceValue.TimePerDistance(15);
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(0, 200, 0, 100),
                secondBlock, new OccupancySegment(0, 600, 0, 100),
                thirdBlock, new OccupancySegment(0, 1200, 0, 100),
                forthBlock, new OccupancySegment(0, 2000, 0, 100)
        );
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthBlock, 100)))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withoutAllowance);
        assertNotNull(res.withAllowance);
        occupancyTest(infraBuilder.fullInfra(), res.withAllowance, occupancyGraph, timeStep);

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * timeStep);
    }

    /** The path we find must pass through an (almost) exact space-time point at the middle of the path,
     * we check that we can still do this with mareco */
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    public void testMarecoSingleSpaceTimePoint(boolean isTimePerDistance) {
        /*
        a --> b --> c --> d --> e

        space
        d ^
          |           end
        c |########## /
          |##########/
        b |         /#################
          |        / #################
        a |_______/__#################> time

         */
        var infraBuilder = new DummyInfraBuilder();
        var firstBlock = infraBuilder.addBlock("a", "b", 1_000, 30);
        var secondBlock = infraBuilder.addBlock("b", "c", 1_000, 30);
        var thirdBlock = infraBuilder.addBlock("c", "d");
        AllowanceValue allowance = new AllowanceValue.Percentage(100);
        if (isTimePerDistance)
            allowance = new AllowanceValue.TimePerDistance(120);
        var occupancyGraph = ImmutableMultimap.of(
                firstBlock, new OccupancySegment(2_000 + timeStep, POSITIVE_INFINITY, 0, 1_000),
                secondBlock, new OccupancySegment(0, 2_000 - timeStep, 0, 1_000)
        );
        var res = runWithAndWithoutAllowance(new STDCMPathfindingBuilder()
                .setInfra(infraBuilder.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstBlock, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdBlock, 100)))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        );
        assertNotNull(res.withoutAllowance);
        assertNotNull(res.withAllowance);
        assertEquals(0, res.withAllowance.envelope().getEndSpeed());
        assertEquals(0, res.withoutAllowance.envelope().getEndSpeed());
        occupancyTest(infraBuilder.fullInfra(), res.withAllowance, occupancyGraph, 2 * timeStep);

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * timeStep);
    }
}
