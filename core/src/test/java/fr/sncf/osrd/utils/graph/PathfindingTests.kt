package fr.sncf.osrd.utils.graph

import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.infra_exploration.BlockLocation
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetRange
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

data class TestRangeConstraints(val f: (BlockId) -> Collection<OffsetRange<Block>>) :
    PathfindingConstraint {
    override fun apply(edge: BlockId): Collection<OffsetRange<Block>> {
        return f(edge)
    }
}

class PathfindingTests {
    @Test
    fun pathfindingShortestTwoStepsTest() {
        /* Two possible paths, top path is the shortest

        0 -> B -> 1 -> 2 -> 3 -> E -> 4
                   \        /
                    + ->-> +
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 0.meters)
        val block12 = infra.addBlock("1", "2", 10.meters)
        val block23 = infra.addBlock("2", "3", 10.meters)
        infra.addBlock("1", "3", 21.meters)
        val block34 = infra.addBlock("3", "4", 0.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(BlockLocation(block34, Offset(0.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(block01, Offset(0.meters), Offset(0.meters), 0.meters, Length(0.meters)),
                BlockRange(
                    block12,
                    Offset(0.meters),
                    Offset(0.meters),
                    10.meters,
                    Length(10.meters),
                ),
                BlockRange(
                    block23,
                    Offset(0.meters),
                    Offset(10.meters),
                    10.meters,
                    Length(10.meters),
                ),
                BlockRange(block34, Offset(0.meters), Offset(20.meters), 0.meters, Length(0.meters)),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun simplePathfindingTest() {
        /* Same setting as previous test, but the bottom path is the shortest

        0 -> B -> 1 -> 2 -> 3 -> E -> 4
                   \        /
                    + ->-> +
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 0.meters)
        infra.addBlock("1", "2", 10.meters)
        infra.addBlock("2", "3", 10.meters)
        val block13 = infra.addBlock("1", "3", 19.meters)
        val block34 = infra.addBlock("3", "4", 0.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(BlockLocation(block34, Offset(0.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(block01, Offset(0.meters), Offset(0.meters), 0.meters, Length(0.meters)),
                BlockRange(
                    block13,
                    Offset(0.meters),
                    Offset(0.meters),
                    19.meters,
                    Length(19.meters),
                ),
                BlockRange(block34, Offset(0.meters), Offset(19.meters), 0.meters, Length(0.meters)),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun overlappingWaypoints() {
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 10.meters)
        val block12 = infra.addBlock("1", "2", 10.meters)
        val block23 = infra.addBlock("2", "3", 10.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(10.meters))),
                listOf(BlockLocation(block12, Offset(10.meters))),
                listOf(BlockLocation(block12, Offset(10.meters))),
                listOf(BlockLocation(block23, Offset(1.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    block01,
                    Offset(10.meters),
                    Offset(0.meters),
                    0.meters,
                    Length(10.meters),
                ),
                BlockRange(
                    block12,
                    Offset(0.meters),
                    Offset(0.meters),
                    10.meters,
                    Length(10.meters),
                ),
                BlockRange(
                    block23,
                    Offset(0.meters),
                    Offset(10.meters),
                    1.meters,
                    Length(10.meters),
                ),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun severalStartsTest() {
        /* Bottom path has more edges but is shorter

        0 -> B1 -> 1 ->-> +
                          |
                          5 -> E -> 6
                         /
        2 -> B2 -> 3 -> 4
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 0.meters)
        infra.addBlock("1", "5", 10.meters)
        val block23 = infra.addBlock("2", "3", 0.meters)
        val block34 = infra.addBlock("3", "4", 5.meters)
        val block45 = infra.addBlock("4", "5", 4.meters)
        val block56 = infra.addBlock("5", "6", 0.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(
                    BlockLocation(block01, Offset(0.meters)),
                    BlockLocation(block23, Offset(0.meters)),
                ),
                listOf(BlockLocation(block56, Offset(0.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(block23, Offset(0.meters), Offset(0.meters), 0.meters, Length(0.meters)),
                BlockRange(block34, Offset(0.meters), Offset(0.meters), 5.meters, Length(5.meters)),
                BlockRange(block45, Offset(0.meters), Offset(5.meters), 4.meters, Length(4.meters)),
                BlockRange(block56, Offset(0.meters), Offset(9.meters), 0.meters, Length(0.meters)),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun severalEndsTest() {
        /* The bottom path has more edges but is shorter

        0 -> B -> 1 -> 2 -> E1 -> 3
                   \
                    v
                     4 -> 5 -> E2 -> 6
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 0.meters)
        infra.addBlock("1", "2", 10.meters)
        val block23 = infra.addBlock("2", "3", 0.meters)
        val block14 = infra.addBlock("1", "4", 4.meters)
        val block45 = infra.addBlock("4", "5", 5.meters)
        val block56 = infra.addBlock("5", "6", 0.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(
                    BlockLocation(block23, Offset(0.meters)),
                    BlockLocation(block56, Offset(0.meters)),
                ),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(block01, Offset(0.meters), Offset(0.meters), 0.meters, Length(0.meters)),
                BlockRange(block14, Offset(0.meters), Offset(0.meters), 4.meters, Length(4.meters)),
                BlockRange(block45, Offset(0.meters), Offset(4.meters), 5.meters, Length(5.meters)),
                BlockRange(block56, Offset(0.meters), Offset(9.meters), 0.meters, Length(0.meters)),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun loopTest() {
        /* The 1 -> 3 -> 1 path has a null length.
        if the "seen" edges are badly handled, this could start an infinite loop

        0 -> B -> 1 -> E -> 2
         ^        v
          + <-<- +
        */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 1.meters)
        val block13 = infra.addBlock("1", "3", 0.meters)
        val block31 = infra.addBlock("3", "1", 0.meters)
        val block12 = infra.addBlock("1", "2", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(BlockLocation(block12, Offset(50.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(block01, Offset(0.meters), Offset(0.meters), 1.meters, Length(1.meters)),
                // The loop is triggered when favoring multiple blocks, but could disappear.
                // However, the loop can never be used multiple times.
                BlockRange(block13, Offset(0.meters), Offset(1.meters), 0.meters, Length(0.meters)),
                BlockRange(block31, Offset(0.meters), Offset(1.meters), 0.meters, Length(0.meters)),
                BlockRange(
                    block12,
                    Offset(0.meters),
                    Offset(1.meters),
                    50.meters,
                    Length(100.meters),
                ),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun noPathTest() {
        /* No possible path without going backwards

        0 -> E -> 1 -> 2 -> B -> 3
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        infra.addBlock("1", "2", 100.meters)
        val block23 = infra.addBlock("2", "3", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block23, Offset(0.meters))),
                listOf(BlockLocation(block01, Offset(0.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertNull(res)
    }

    @Test
    fun noPathTestSameEdge() {
        /* No possible path without going backwards, with several steps on the last edge

        0 -> B -> 1 -> 2 -> E2 -> E1 -> 3
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        infra.addBlock("1", "2", 100.meters)
        val block23 = infra.addBlock("2", "3", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(BlockLocation(block23, Offset(20.meters))),
                listOf(BlockLocation(block23, Offset(10.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertNull(res)
    }

    @Test
    fun sameEdgeNoPathTest() {
        /* The end is on the same edge but at a smaller offset that the start: no path

        0 -> -> E -> -> B -> -> 1
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(60.meters))),
                listOf(BlockLocation(block01, Offset(30.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertNull(res)
    }

    @Test
    fun sameEdgeMoreUnorderedWaypointsTest() {
        /* Same test as above but with more steps

        0 -> -> B -> -> E -> -> Step -> -> 1
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        infra.addBlock("1", "2", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(10.meters))),
                listOf(BlockLocation(block01, Offset(40.meters))),
                listOf(BlockLocation(block01, Offset(20.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertNull(res)
    }

    @Test
    fun sameEdgeWithLoopTest() {
        /* The end is at a smaller offset that the start: it has to loop through the edges to reach it

        0 - -> E - -> B - -> 1
         ^                  /
          \                v
           + <- - 2 <- -  +
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val block12 = infra.addBlock("1", "2", 100.meters)
        val block20 = infra.addBlock("2", "0", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(60.meters))),
                listOf(BlockLocation(block01, Offset(30.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    block01,
                    Offset(60.meters),
                    Offset(0.meters),
                    40.meters,
                    Length(100.meters),
                ),
                BlockRange(
                    block12,
                    Offset(0.meters),
                    Offset(40.meters),
                    100.meters,
                    Length(100.meters),
                ),
                BlockRange(
                    block20,
                    Offset(0.meters),
                    Offset(140.meters),
                    100.meters,
                    Length(100.meters),
                ),
                BlockRange(
                    block01,
                    Offset(0.meters),
                    Offset(240.meters),
                    30.meters,
                    Length(100.meters),
                ),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun shortestPathWithOffsetsTests() {
        /* The start of the end edge is closer on the 0 -> 1 -> 2 -> 3 path,
        but the 0 -> 1 -> 4 -> 5 path is shortest if we account offsets correctly

        0 - B - 1 - 2 - - - - - E1 - 3
                 \
                  4 - E2 - 5
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 0.meters)
        infra.addBlock("1", "2", 10.meters)
        val block23 = infra.addBlock("2", "3", 1000.meters)
        val block14 = infra.addBlock("1", "4", 100.meters)
        val block45 = infra.addBlock("4", "5", 1000.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(
                    BlockLocation(block23, Offset(500.meters)),
                    BlockLocation(block45, Offset(10.meters)),
                ),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(block01, Offset(0.meters), Offset(0.meters), 0.meters, Length(0.meters)),
                BlockRange(
                    block14,
                    Offset(0.meters),
                    Offset(0.meters),
                    100.meters,
                    Length(100.meters),
                ),
                BlockRange(
                    block45,
                    Offset(0.meters),
                    Offset(100.meters),
                    10.meters,
                    Length(1000.meters),
                ),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun intermediateStopTest() {
        /* Shortest path from B to E is 0 - 1 - 2 - 3
        But it has to pass through a step on 4 - 5 along the way

        0 - B - 1 - - - -  2 - E - 3
                 \        /
                  4 step 5
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 10.meters)
        infra.addBlock("1", "2", 10.meters)
        val block23 = infra.addBlock("2", "3", 10.meters)
        val block14 = infra.addBlock("1", "4", 1000.meters)
        val block45 = infra.addBlock("4", "5", 10.meters)
        val block52 = infra.addBlock("5", "2", 1000.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(5.meters))),
                listOf(BlockLocation(block45, Offset(5.meters))),
                listOf(BlockLocation(block23, Offset(5.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    block01,
                    Offset(5.meters),
                    Offset(0.meters),
                    5.meters,
                    Length(10.meters),
                ),
                BlockRange(
                    block14,
                    Offset(0.meters),
                    Offset(5.meters),
                    1000.meters,
                    Length(1000.meters),
                ),
                BlockRange(
                    block45,
                    Offset(0.meters),
                    Offset(1005.meters),
                    10.meters,
                    Length(10.meters),
                ),
                BlockRange(
                    block52,
                    Offset(0.meters),
                    Offset(1015.meters),
                    1000.meters,
                    Length(1000.meters),
                ),
                BlockRange(
                    block23,
                    Offset(0.meters),
                    Offset(2015.meters),
                    5.meters,
                    Length(10.meters),
                ),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun blockedRangeRightPathTest() {
        /* Top path is shorter but blocked

        0 -> B1 -> BLOCKED -> 1
                              |
                              v
                              4 -> E -> 5
                              ^
        2 -> B2 -> -> -> ->-> 3
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        infra.addBlock("1", "4", 100.meters)
        val block23 = infra.addBlock("2", "3", 100.meters)
        val block34 = infra.addBlock("3", "4", 100000.meters)
        val block45 = infra.addBlock("4", "5", 0.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(
                    BlockLocation(block01, Offset(0.meters)),
                    BlockLocation(block23, Offset(0.meters)),
                ),
                listOf(BlockLocation(block45, Offset(0.meters))),
            )
        val res =
            runPathFinding(
                waypoints,
                infra,
                constraints =
                    listOf(
                        TestRangeConstraints { edge ->
                            if (edge == block01)
                                setOf(OffsetRange(Offset(50.meters), Offset(50.meters)))
                            else setOf()
                        }
                    ),
            )
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    block23,
                    Offset(0.meters),
                    Offset(0.meters),
                    100.meters,
                    Length(100.meters),
                ),
                BlockRange(
                    block34,
                    Offset(0.meters),
                    Offset(100.meters),
                    100000.meters,
                    Length(100000.meters),
                ),
                BlockRange(
                    block45,
                    Offset(0.meters),
                    Offset(100100.meters),
                    0.meters,
                    Length(0.meters),
                ),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun blockedStartTest() {
        /* Single edge, the start is on a blocked range

        0 -> BLOCKED( -> B -> E -> ) -> 1
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(5.meters))),
                listOf(BlockLocation(block01, Offset(7.meters))),
            )
        val res =
            runPathFinding(
                waypoints,
                infra,
                constraints =
                    listOf(
                        TestRangeConstraints { edge ->
                            if (edge == block01)
                                setOf(OffsetRange(Offset(0.meters), Offset(10.meters)))
                            else setOf()
                        }
                    ),
            )
        Assertions.assertNull(res)
    }

    @Test
    fun pathBetweenBlockedRangesTest() {
        /* Single edge, there are blocked ranges before and after the path

        0 -> BLOCKED() -> B -> E -> BLOCKED() -> 1
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(40.meters))),
                listOf(BlockLocation(block01, Offset(50.meters))),
            )
        val res =
            runPathFinding(
                waypoints,
                infra,
                constraints =
                    listOf(
                        TestRangeConstraints { edge ->
                            if (edge == block01)
                                setOf(
                                    OffsetRange(Offset(0.meters), Offset(30.meters)),
                                    OffsetRange(Offset(70.meters), Offset(100.meters)),
                                )
                            else setOf()
                        }
                    ),
            )
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    block01,
                    Offset(40.meters),
                    Offset(0.meters),
                    10.meters,
                    Length(100.meters),
                )
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun blockedAfterEnd() {
        /* Several edges, the last edge is blocked after the end

        0 -> B -> 1 -> E -> BLOCKED() -> 2
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val block12 = infra.addBlock("1", "2", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(BlockLocation(block12, Offset(50.meters))),
            )
        val res =
            runPathFinding(
                waypoints,
                infra,
                constraints =
                    listOf(
                        TestRangeConstraints { edge ->
                            if (edge == block12)
                                setOf(OffsetRange(Offset(70.meters), Offset(100.meters)))
                            else setOf()
                        }
                    ),
            )
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    block01,
                    Offset(0.meters),
                    Offset(0.meters),
                    100.meters,
                    Length(100.meters),
                ),
                BlockRange(
                    block12,
                    Offset(0.meters),
                    Offset(100.meters),
                    50.meters,
                    Length(100.meters),
                ),
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun blockedBeforeEnd() {
        /* Several edges, the last edge is blocked before the end

        0 -> B -> 1 -> BLOCKED() -> E -> 2
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val block12 = infra.addBlock("1", "2", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(BlockLocation(block12, Offset(50.meters))),
            )
        val res =
            runPathFinding(
                waypoints,
                infra,
                constraints =
                    listOf(
                        TestRangeConstraints { edge ->
                            if (edge == block12)
                                setOf(OffsetRange(Offset(10.meters), Offset(20.meters)))
                            else setOf()
                        }
                    ),
            )
        Assertions.assertNull(res)
    }

    @Test
    fun severalStartsWithBlockedRange() {
        /* Some starting points are blocked, others are not

        0 -> B1 -> BLOCKED -> B2 -> E -> 1
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(
                    BlockLocation(block01, Offset(10.meters)),
                    BlockLocation(block01, Offset(40.meters)),
                ),
                listOf(BlockLocation(block01, Offset(50.meters))),
            )
        val res =
            runPathFinding(
                waypoints,
                infra,
                constraints =
                    listOf(
                        TestRangeConstraints { edge ->
                            if (edge == block01)
                                setOf(OffsetRange(Offset(10.meters), Offset(20.meters)))
                            else setOf()
                        }
                    ),
            )
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    block01,
                    Offset(40.meters),
                    Offset(0.meters),
                    10.meters,
                    Length(100.meters),
                )
            ),
            res!!.getAllBlocks(),
        )
    }

    @Test
    fun overlappingBlockedRanges() {
        /* Blocked ranges overlap

        0 -> + -> -> + -> -> + -> B -> E -> + -> 1
             +  - blocked -  +
                     +  -  blocked -  -  -  +
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(55.meters))),
                listOf(BlockLocation(block01, Offset(60.meters))),
            )
        val res =
            runPathFinding(
                waypoints,
                infra,
                constraints =
                    listOf(
                        TestRangeConstraints { edge ->
                            if (edge == block01)
                                setOf(
                                    OffsetRange(Offset(10.meters), Offset(50.meters)),
                                    OffsetRange(Offset(30.meters), Offset(80.meters)),
                                )
                            else setOf()
                        }
                    ),
            )
        Assertions.assertNull(res)
    }

    @Test
    fun pathfindingDisjointedPaths() {
        /* Two disjointed paths, top one is direct and fastest, bottom one is split

        0 -> B1 ------> E1 -> 1
        2 -> B2 -> 3 -> 4 -> E2 -> 5
         */
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 10000.meters)
        val block23 = infra.addBlock("2", "3", 1000.meters)
        infra.addBlock("3", "4", 1000.meters)
        val block45 = infra.addBlock("4", "5", 1000.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(
                    BlockLocation(block01, Offset(5000.meters)),
                    BlockLocation(block23, Offset(0.meters)),
                ),
                listOf(
                    BlockLocation(block01, Offset(6999.meters)),
                    BlockLocation(block45, Offset(1000.meters)),
                ),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    block01,
                    Offset(5000.meters),
                    Offset(0.meters),
                    1999.meters,
                    Length(10000.meters),
                )
            ),
            res!!.getAllBlocks(),
        )
    }

    @ParameterizedTest
    @CsvSource("0, true", "10, false", ", false")
    fun pathfindingTimesOut(timeout: Long?, timesOut: Boolean) {
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(BlockLocation(block01, Offset(0.meters))),
                listOf(BlockLocation(block01, Offset(10.meters))),
            )

        if (!timesOut) {
            val res = runPathFinding(waypoints, infra, timeout = timeout?.toDouble())
            Assertions.assertEquals(
                arrayListOf(
                    BlockRange(
                        block01,
                        Offset(0.meters),
                        Offset(0.meters),
                        10.meters,
                        Length(100.meters),
                    )
                ),
                res!!.getAllBlocks(),
            )
        } else {
            AssertionsForClassTypes.assertThatThrownBy {
                    runPathFinding(waypoints, infra, timeout = timeout?.toDouble())
                }
                .isExactlyInstanceOf(OSRDError::class.java)
                .satisfies({ exception: Throwable? ->
                    org.assertj.core.api.Assertions.assertThat(
                            (exception as OSRDError?)!!.osrdErrorType
                        )
                        .isEqualTo(ErrorType.PathfindingTimeoutError)
                })
        }
    }

    /**
     * Check that the cost function is used, shortest path is longest. This test uses STDCM tooling
     * to have speed limits.
     */
    @Test
    fun emptyTimetable() {
        /*
                FAST
        a ---------------> b -> c
                           ^
                    x ----/
                      SLOW
         */
        val infra = DummyInfra()
        val fast = infra.addBlock("a", "b", 4_999.meters, 50.0)
        val slow = infra.addBlock("x", "b", 100.meters, 1.0)
        val secondBlock = infra.addBlock("b", "c", 100.meters)
        val waypoints =
            arrayListOf<Collection<BlockLocation>>(
                listOf(
                    BlockLocation(slow, Offset(0.meters)),
                    BlockLocation(fast, Offset(0.meters)),
                ),
                listOf(BlockLocation(secondBlock, Offset(0.meters))),
            )
        val res = runPathFinding(waypoints, infra)
        Assertions.assertEquals(
            arrayListOf(
                BlockRange(
                    fast,
                    Offset(0.meters),
                    Offset(0.meters),
                    4999.meters,
                    Length(4999.meters),
                ),
                BlockRange(
                    secondBlock,
                    Offset(0.meters),
                    Offset(4999.meters),
                    0.meters,
                    Length(100.meters),
                ),
            ),
            res!!.getAllBlocks(),
        )
    }

    private fun runPathFinding(
        targets: List<Collection<BlockLocation>>,
        infra: DummyInfra,
        rollingStock: RollingStock = TestTrains.REALISTIC_FAST_TRAIN,
        speedLimitTag: String? = null,
        constraints: List<PathfindingConstraint> = listOf(),
        timeout: Double? = null,
    ): InfraExplorer? {
        if (timeout == null)
            return Pathfinding(
                    infra.fullInfra(),
                    targets,
                    constraints,
                    speedLimitTag,
                    rollingStock.maxSpeed,
                    rollingStock.length,
                )
                .runPathfinding()
        else
            return Pathfinding(
                    infra.fullInfra(),
                    targets,
                    constraints,
                    speedLimitTag,
                    rollingStock.maxSpeed,
                    rollingStock.length,
                )
                .runPathfinding(timeout)
    }
}
