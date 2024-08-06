package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import com.google.common.collect.Iterables
import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test

@Disabled(
    "to be enabled when running profilers or benchmarks, not part of the tests to run by default"
)
class PerformanceTests {
    @Test
    fun testManyOpenings() {
        /*
        This is a stress test simulating a very busy schedule on a linear line.

        We create one very long infra (1000 consecutive blocks of 1km each).
        Several occupancy segments are added at arbitrary points of any block,
        in a way that lets the new train zigzag between the blocks.
        We then try to find a path.

        The main purpose of this test is to run profilers and benchmarks.
         */
        val infra = DummyInfra()
        val blocks = ArrayList<BlockId>()
        for (i in 0..999) blocks.add(
            infra.addBlock(i.toString(), (i + 1).toString(), 1000.meters, 30.0)
        )
        val occupancyGraphBuilder = ImmutableMultimap.builder<BlockId, OccupancySegment>()
        for (i in 0..19) {
            val startTime = 600 * i
            val endTime = startTime + 60
            val occupancySegment =
                OccupancySegment(startTime.toDouble(), endTime.toDouble(), 0.meters, 1000.meters)
            var j = 0
            while (j < blocks.size) {
                occupancyGraphBuilder.put(blocks[j], occupancySegment)
                j += 5
            }
        }
        val occupancyGraph = occupancyGraphBuilder.build()
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset<Block>(0.meters))))
                .setEndLocations(
                    setOf(EdgeLocation(Iterables.getLast(blocks), Offset<Block>(0.meters)))
                )
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
    }

    @Test
    fun testManyOpeningsNoSolution() {
        /*
        This is a stress test simulating a very busy schedule on a linear line.
        This time, no path can be found.

        We create one very long infra (1000 consecutive blocks of 1km each).
        Several occupancy segments are added at arbitrary points of any block,
        in a way that lets the new train zigzag between the blocks.
        We then try to find a path to an impossible solution.

        The main purpose of this test is to run profilers and benchmarks.
         */
        val infra = DummyInfra()
        val blocks = ArrayList<BlockId>()
        for (i in 0..999) blocks.add(
            infra.addBlock(i.toString(), (i + 1).toString(), 1000.meters, 30.0)
        )
        val unreachable = infra.addBlock("unreachable", "unreachable2")
        val occupancyGraphBuilder = ImmutableMultimap.builder<BlockId, OccupancySegment>()
        for (i in 0..19) {
            val startTime = 600 * i
            val endTime = startTime + 60
            val occupancySegment =
                OccupancySegment(startTime.toDouble(), endTime.toDouble(), 0.meters, 1000.meters)
            var j = 0
            while (j < blocks.size) {
                occupancyGraphBuilder.put(blocks[j], occupancySegment)
                j += 5
            }
        }
        val occupancyGraph = occupancyGraphBuilder.build()
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset<Block>(0.meters))))
                .setEndLocations(setOf(EdgeLocation(unreachable, Offset<Block>(0.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run()
        Assertions.assertNull(res)
    }

    @Disabled("We're not quite there yet")
    @Test
    fun testManyWithDifferentPaths() {
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
        val infra = DummyInfra()
        val blocks = ArrayList<BlockId>()
        for (i in 0..249) {
            val a1 = String.format("a%d", i)
            val b1 = String.format("b%d", i)
            val a2 = String.format("a%d", i + 1)
            val b2 = String.format("b%d", i + 1)
            blocks.add(infra.addBlock(a1, a2, 1000.meters, 30.0))
            blocks.add(infra.addBlock(a1, b2, 1000.meters, 30.0))
            blocks.add(infra.addBlock(b1, a2, 1000.meters, 30.0))
            blocks.add(infra.addBlock(b1, b2, 1000.meters, 30.0))
        }
        val occupancyGraphBuilder = ImmutableMultimap.builder<BlockId, OccupancySegment>()
        for (i in 0..19) {
            val startTime = 600 * i
            val endTime = startTime + 60
            val occupancySegment =
                OccupancySegment(startTime.toDouble(), endTime.toDouble(), 0.meters, 1000.meters)
            var j = 0
            while (j < blocks.size) {
                occupancyGraphBuilder.put(blocks[j], occupancySegment)
                j += 5
            }
        }
        val occupancyGraph = occupancyGraphBuilder.build()
        val timeStep = 2.0
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset<Block>(0.meters))))
                .setEndLocations(
                    setOf(EdgeLocation(Iterables.getLast(blocks), Offset<Block>(0.meters)))
                )
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(
                    timeStep
                ) // TODO: remove this once the test runs in less than Pathfinding.TIMEOUT
                .setPathfindingTimeout(Double.POSITIVE_INFINITY)
                .run()!!
        occupancyTest(res, occupancyGraph, 2 * timeStep)
    }

    @Disabled("Requires at least one bugfix (and likely more): this starts an infinite loop")
    @Test
    fun testGrid() {
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
        val width = 100
        val height = 100
        val infra = DummyInfra()
        for (i in 0 until height) {
            for (j in 0 until width) {
                val id = String.format("%d,%d", i, j)
                infra.detectorGeoPoint[id] = Point(0.01 * j, 0.01 * i)
            }
        }
        for (i in 0 until height) {
            for (j in 0 until width) {
                val center = String.format("%d,%d", i, j)
                val centerGeo = infra.detectorGeoPoint[center]
                for (offsetI in -1..1) {
                    for (offsetJ in -1..1) {
                        if (offsetI == 0 == (offsetJ == 0))
                            continue // we want exactly one of the offsets to be == 0 (avoids self
                        // links and
                        // diagonals)
                        val otherI = i + offsetI
                        val otherJ = j + offsetJ
                        if (otherI < 0 || otherI >= height || otherJ < 0 || otherJ >= width)
                            continue
                        val other = String.format("%d,%d", otherI, otherJ)
                        val length = centerGeo!!.distanceAsMeters(infra.detectorGeoPoint[other])
                        infra.addBlock(center, other, Distance.fromMeters(length))
                        infra.addBlock(other, center, Distance.fromMeters(length))
                    }
                }
            }
        }
        val timeStep = 2.0
        STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setStartLocations(
                setOf(
                    EdgeLocation(
                        BlockId(infra.getRouteFromName("25,25->25,26").index),
                        Offset<Block>(0.meters)
                    )
                )
            )
            .setEndLocations(
                setOf(
                    EdgeLocation(
                        BlockId(infra.getRouteFromName("75,75->75,76").index),
                        Offset<Block>(0.meters)
                    )
                )
            )
            .setTimeStep(timeStep)
            .run()!!
        // TODO: count visited edges
    }
}
