package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.stdcm.STDCMHelpers.meters;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.collect.Iterables;
import fr.sncf.osrd.geom.Point;
import fr.sncf.osrd.utils.DummyInfra;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.Set;

@Disabled("to be enabled when running profilers or benchmarks, not part of the tests to run by default")
public class PerformanceTests {

    @Test
    public void testManyOpenings() {
        /*
        This is a stress test simulating a very busy schedule on a linear line.

        We create one very long infra (1000 consecutive blocks of 1km each).
        Several occupancy segments are added at arbitrary points of any block,
        in a way that lets the new train zigzag between the blocks.
        We then try to find a path.

        The main purpose of this test is to run profilers and benchmarks.
         */
        var infra = DummyInfra.make();
        var blocks = new ArrayList<Integer>();
        for (int i = 0; i < 1000; i++)
            blocks.add(infra.addBlock(Integer.toString(i), Integer.toString(i + 1), meters(1_000), 30));

        var occupancyGraphBuilder = ImmutableMultimap.<Integer, OccupancySegment>builder();
        for (int i = 0; i < 20; i++) {
            var startTime = 600 * i;
            var endTime = startTime + 60;
            var occupancySegment = new OccupancySegment(startTime, endTime, 0, meters(1_000));
            for (int j = 0; j < blocks.size(); j += 5)
                occupancyGraphBuilder.put(blocks.get(j), occupancySegment);
        }
        var occupancyGraph = occupancyGraphBuilder.build();
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(Iterables.getLast(blocks), 0)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph, 2 * timeStep);
    }

    @Test
    public void testManyOpeningsNoSolution() {
        /*
        This is a stress test simulating a very busy schedule on a linear line.
        This time, no path can be found.

        We create one very long infra (1000 consecutive blocks of 1km each).
        Several occupancy segments are added at arbitrary points of any block,
        in a way that lets the new train zigzag between the blocks.
        We then try to find a path to an impossible solution.

        The main purpose of this test is to run profilers and benchmarks.
         */
        var infra = DummyInfra.make();
        var blocks = new ArrayList<Integer>();
        for (int i = 0; i < 1000; i++)
            blocks.add(infra.addBlock(Integer.toString(i), Integer.toString(i + 1), meters(1_000), 30));
        var unreachable = infra.addBlock("unreachable", "unreachable2");

        var occupancyGraphBuilder = ImmutableMultimap.<Integer, OccupancySegment>builder();
        for (int i = 0; i < 20; i++) {
            var startTime = 600 * i;
            var endTime = startTime + 60;
            var occupancySegment = new OccupancySegment(startTime, endTime, 0, meters(1_000));
            for (int j = 0; j < blocks.size(); j += 5)
                occupancyGraphBuilder.put(blocks.get(j), occupancySegment);
        }
        var occupancyGraph = occupancyGraphBuilder.build();
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(unreachable, 0)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNull(res);
    }

    @Disabled("We're not quite there yet")
    @Test
    public void testManyWithDifferentPaths() {
        /*
        This is a stress test simulating a very busy schedule on a line with two tracks.
        For any i, there is a block going from a$i to a$i+1 and b$i+1,
        and a block going from b$i to a$i+1 and b$i+1.

        If we don't have a robust way to handle "seen" nodes, this would take an exponential time.

        a1 -> a2 -> a3 -> a4
          \   ^ \   ^ \   ^
           \ /   \ /   \ /
            X     X     X
           / \   / \   / \
          /   v /   v /   v
        b1 -> b2 -> b3 -> b4
         */
        var infra = DummyInfra.make();
        var blocks = new ArrayList<Integer>();
        for (int i = 0; i < 250; i++) {
            var a1 = String.format("a%d", i);
            var b1 = String.format("b%d", i);
            var a2 = String.format("a%d", i + 1);
            var b2 = String.format("b%d", i + 1);
            blocks.add(infra.addBlock(a1, a2, meters(1_000), 30));
            blocks.add(infra.addBlock(a1, b2, meters(1_000), 30));
            blocks.add(infra.addBlock(b1, a2, meters(1_000), 30));
            blocks.add(infra.addBlock(b1, b2, meters(1_000), 30));
        }

        var occupancyGraphBuilder = ImmutableMultimap.<Integer, OccupancySegment>builder();
        for (int i = 0; i < 20; i++) {
            var startTime = 600 * i;
            var endTime = startTime + 60;
            var occupancySegment = new OccupancySegment(startTime, endTime, 0, meters(1_000));
            for (int j = 0; j < blocks.size(); j += 5)
                occupancyGraphBuilder.put(blocks.get(j), occupancySegment);
        }
        var occupancyGraph = occupancyGraphBuilder.build();
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(blocks.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(Iterables.getLast(blocks), 0)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                //TODO: remove this once the test runs in less than Pathfinding.TIMEOUT
                .setPathfindingTimeout(Double.POSITIVE_INFINITY)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph, 2 * timeStep);
    }

    @Disabled("Requires at least one bugfix (and likely more): this starts an infinite loop")
    @Test
    public void testGrid() {
        /*
        In this test, we have a large grid where trains can go both ways.
        For any i and j, there are blocks going back and forth linking $i,$j
        to $i,$j+1, $i,$j-1, $i+1,$j, and $i-1,$j.

        This test is mostly meant to check the efficiency of the heuristic.

        1,1 <--> 1,2 <--> 1,3 <--> 1,4 <--> ...
         ^        ^        ^        ^
         v        v        v        v
        2,1 <--> 2,2 <--> 2,3 <--> 2,4 <--> ...
         ^        ^        ^        ^
         v        v        v        v
        3,1 <--> 3,2 <--> 3,3 <--> 3,4 <--> ...

        The infra goes from 0,0 to 99,99. We look for a path from 25,25 to 75,75.
        We count the number of visited edges.

        Blocks have geometry data which exactly match their lengths. We aim for roughly 1km blocks.

         */
        final var width = 100;
        final var height = 100;

        var infra = DummyInfra.make();
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                var id = String.format("%d,%d", i, j);
                infra.getDetectorGeoPoint().put(id, new Point(0.01 * i, 0.01 * j));
            }
        }
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                var center = String.format("%d,%d", i, j);
                var centerGeo = infra.getDetectorGeoPoint().get(center);
                for (var offsetI = -1; offsetI <= 1; offsetI++) {
                    for (var offsetJ = -1; offsetJ <= 1; offsetJ++) {
                        if ((offsetI == 0) == (offsetJ == 0))
                            continue; // we want exactly one of the offsets to be == 0 (avoids self links and diagonals)
                        var otherI = i + offsetI;
                        var otherJ = j + offsetJ;
                        if (otherI < 0 || otherI >= height || otherJ < 0 || otherJ >= width)
                            continue;
                        var other = String.format("%d,%d", otherI, otherJ);
                        var length = centerGeo.distanceAsMeters(infra.getDetectorGeoPoint().get(other));
                        infra.addBlock(center, other, meters(length), 30);
                        infra.addBlock(other, center, meters(length), 30);
                    }
                }
            }
        }

        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(Set.of(
                        new Pathfinding.EdgeLocation<>(infra.getRouteFromName("25,25->25,26"), 0))
                )
                .setEndLocations(Set.of(
                        new Pathfinding.EdgeLocation<>(infra.getRouteFromName("75,75->75,76"), 0))
                )
                .setTimeStep(timeStep)
                .run();
        // TODO: count visited edges
        assertNotNull(res);
    }

}
