package fr.sncf.osrd.utils.graph

import com.google.common.graph.NetworkBuilder
import fr.sncf.osrd.graph.Graph
import fr.sncf.osrd.graph.GraphAdapter
import fr.sncf.osrd.graph.NetworkGraphAdapter
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.graph.PathfindingTests.SimpleGraphBuilder.Edge
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Collectors
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

class PathfindingTests {
    class SimpleGraphBuilder {
        data class Edge(
            val length: Length<Edge>,
            val label: String,
            val blockedRanges: Set<Pathfinding.Range<Edge>>
        )

        class Node

        private val builder =
            NetworkBuilder.directed().allowsParallelEdges(true).immutable<Node, Edge>()
        private val edges: MutableMap<String, Edge> = HashMap()
        private val nodes: MutableList<Node> = ArrayList()

        private fun makeNode() {
            val res = Node()
            builder.addNode(res)
            nodes.add(res)
        }

        fun makeNodes(n: Int) {
            for (i in 0 until n) makeNode()
        }

        fun makeEdge(
            n1: Int,
            n2: Int,
            length: Distance,
            blockedRanges: Set<Pathfinding.Range<Edge>> = setOf()
        ) {
            val label = String.format("%d-%s", n1, n2)
            val res = Edge(Length(length), label, blockedRanges)
            builder.addEdge(nodes[n1], nodes[n2], res)
            edges[label] = res
        }

        fun build(): Graph<Node, Edge, Edge> {
            return NetworkGraphAdapter(builder.build())
        }

        fun getEdgeLocation(id: String, offset: Distance): EdgeLocation<Edge, Edge> {
            return EdgeLocation(edges[id]!!, Offset(offset))
        }

        fun getEdgeLocation(id: String): EdgeLocation<Edge, Edge> {
            return EdgeLocation(edges[id]!!, Offset(0.meters))
        }
    }

    /** A range where the edge is only referenced by its ID (for easier equality check) */
    data class SimpleRange(val id: String, val begin: Offset<Edge>, val end: Offset<Edge>)

    @Test
    fun pathfindingShortestTwoStepsTest() {
        /* Two possible paths, top path is the shortest

        0 -> B -> 1 -> 2 -> 3 -> E -> 4
                   \        /
                    + ->-> +
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(5)
        builder.makeEdge(0, 1, 0.meters)
        builder.makeEdge(1, 2, 10.meters)
        builder.makeEdge(2, 3, 10.meters)
        builder.makeEdge(1, 3, 21.meters)
        builder.makeEdge(3, 4, 0.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1")),
                        listOf(builder.getEdgeLocation("3-4"))
                    )
                )
        val resIDs = res!!.stream().map { x -> x!!.label }.toList()
        Assertions.assertEquals(listOf("0-1", "1-2", "2-3", "3-4"), resIDs)
    }

    @Test
    fun simplePathfindingTest() {
        /* Same setting as previous test, but the bottom path is the shortest

        0 -> B -> 1 -> 2 -> 3 -> E -> 4
                   \        /
                    + ->-> +
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(5)
        builder.makeEdge(0, 1, 0.meters)
        builder.makeEdge(1, 2, 10.meters)
        builder.makeEdge(2, 3, 10.meters)
        builder.makeEdge(1, 3, 19.meters)
        builder.makeEdge(3, 4, 0.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1")),
                        listOf(builder.getEdgeLocation("3-4"))
                    )
                )
        val resIDs = res!!.stream().map { x -> x!!.label }.toList()
        Assertions.assertEquals(listOf("0-1", "1-3", "3-4"), resIDs)
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
        val builder = SimpleGraphBuilder()
        builder.makeNodes(7)
        builder.makeEdge(0, 1, 0.meters)
        builder.makeEdge(1, 5, 10.meters)
        builder.makeEdge(2, 3, 0.meters)
        builder.makeEdge(3, 4, 5.meters)
        builder.makeEdge(4, 5, 4.meters)
        builder.makeEdge(5, 6, 0.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1"), builder.getEdgeLocation("2-3")),
                        listOf(builder.getEdgeLocation("5-6"))
                    )
                )
        val resIDs = res!!.stream().map { x -> x!!.label }.toList()
        Assertions.assertEquals(listOf("2-3", "3-4", "4-5", "5-6"), resIDs)
    }

    @Test
    fun severalEndsTest() {
        /* The bottom path has more edges but is shorter

        0 -> B -> 1 -> 2 -> E1 -> 2
                   \
                    v
                     4 -> 5 -> E2 -> 6
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(7)
        builder.makeEdge(0, 1, 0.meters)
        builder.makeEdge(1, 2, 10.meters)
        builder.makeEdge(2, 3, 0.meters)
        builder.makeEdge(1, 4, 4.meters)
        builder.makeEdge(4, 5, 5.meters)
        builder.makeEdge(5, 6, 0.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1")),
                        listOf(builder.getEdgeLocation("2-3"), builder.getEdgeLocation("5-6"))
                    )
                )
        val resIDs = res!!.stream().map { x -> x!!.label }.toList()
        Assertions.assertEquals(listOf("0-1", "1-4", "4-5", "5-6"), resIDs)
    }

    @Test
    fun loopTest() {
        /* The 1 -> 0 path has a negative length.
        if the "seen" edges are badly handled, this starts an infinite loop

        0 -> B -> 1 -> E -> 2
         ^        v
          + <-<- +
        */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(3)
        builder.makeEdge(0, 1, 1.meters)
        builder.makeEdge(1, 2, 100.meters)
        builder.makeEdge(1, 0, (-100).meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1")),
                        listOf(builder.getEdgeLocation("1-2", 50.meters))
                    )
                )
        val resIDs = res!!.stream().map { x -> x!!.label }.toList()
        Assertions.assertEquals(listOf("0-1", "1-2"), resIDs)
    }

    @Test
    fun noPathTest() {
        /* No possible path without going backwards

        0 -> E -> 1 -> 2 -> B -> 3
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(4)
        builder.makeEdge(0, 1, 100.meters)
        builder.makeEdge(1, 2, 100.meters)
        builder.makeEdge(2, 3, 100.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("2-3")),
                        listOf(builder.getEdgeLocation("0-1"))
                    )
                )
        Assertions.assertNull(res)
    }

    @Test
    fun noPathTestSameEdge() {
        /* No possible path without going backwards, with several steps on the last edge

        0 -> B -> 1 -> 2 -> E2 -> E1 -> 3
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(4)
        builder.makeEdge(0, 1, 100.meters)
        builder.makeEdge(1, 2, 100.meters)
        builder.makeEdge(2, 3, 100.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1")),
                        listOf(builder.getEdgeLocation("2-3", 20.meters)),
                        listOf(builder.getEdgeLocation("2-3", 10.meters))
                    )
                )
        Assertions.assertNull(res)
    }

    @Test
    fun sameEdgeNoPathTest() {
        /* The end is on the same edge but at a smaller offset that the start: no path

        0 -> -> E -> -> B -> -> 1
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(2)
        builder.makeEdge(0, 1, 100.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1", 60.meters)),
                        listOf(builder.getEdgeLocation("0-1", 30.meters))
                    )
                )
        Assertions.assertNull(res)
    }

    @Test
    fun sameEdgeMoreUnorderedWaypointsTest() {
        /* Same test as above but with more steps

        0 -> -> B -> -> E -> -> Step -> -> 1
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(3)
        builder.makeEdge(0, 1, 100.meters)
        builder.makeEdge(1, 2, 100.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1", 10.meters)),
                        listOf(builder.getEdgeLocation("0-1", 40.meters)),
                        listOf(builder.getEdgeLocation("0-1", 20.meters)),
                    )
                )
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
        val builder = SimpleGraphBuilder()
        builder.makeNodes(3)
        builder.makeEdge(0, 1, 100.meters)
        builder.makeEdge(1, 2, 100.meters)
        builder.makeEdge(2, 0, 100.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1", 60.meters)),
                        listOf(builder.getEdgeLocation("0-1", 30.meters))
                    )
                )
        val resIDs = res!!.stream().map { x -> x!!.label }.toList()
        Assertions.assertEquals(listOf("0-1", "1-2", "2-0", "0-1"), resIDs)
    }

    @Test
    fun shortestPathWithOffsetsTests() {
        /* The start of the end edge is closer on the 0 -> 1 -> 2 -> 3 path,
        but the 0 -> 1 -> 4 -> 5 path is shortest if we account offsets correctly

        0 - B - 1 - 2 - - - - - E1 - 3
                 \
                  4 - E2 - 5
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(6)
        builder.makeEdge(0, 1, 0.meters)
        builder.makeEdge(1, 2, 10.meters)
        builder.makeEdge(2, 3, 1000.meters)
        builder.makeEdge(1, 4, 100.meters)
        builder.makeEdge(4, 5, 1000.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfinding(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1")),
                        listOf(
                            builder.getEdgeLocation("2-3", 500.meters),
                            builder.getEdgeLocation("4-5", 10.meters)
                        )
                    )
                )!!
        Assertions.assertEquals(
            listOf(
                SimpleRange("0-1", Offset(0.meters), Offset(0.meters)),
                SimpleRange("1-4", Offset(0.meters), Offset(100.meters)),
                SimpleRange("4-5", Offset(0.meters), Offset(10.meters))
            ),
            convertRes(res)
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
        val builder = SimpleGraphBuilder()
        builder.makeNodes(6)
        builder.makeEdge(0, 1, 10.meters)
        builder.makeEdge(1, 2, 10.meters)
        builder.makeEdge(2, 3, 10.meters)
        builder.makeEdge(1, 4, 1000.meters)
        builder.makeEdge(4, 5, 10.meters)
        builder.makeEdge(5, 2, 1000.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfinding(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1", 5.meters)),
                        listOf(builder.getEdgeLocation("4-5", 5.meters)),
                        listOf(builder.getEdgeLocation("2-3", 5.meters))
                    )
                )!!
        Assertions.assertEquals(
            listOf(
                SimpleRange("0-1", Offset(5.meters), Offset(10.meters)),
                SimpleRange("1-4", Offset(0.meters), Offset(1000.meters)),
                SimpleRange("4-5", Offset(0.meters), Offset(10.meters)),
                SimpleRange("5-2", Offset(0.meters), Offset(1000.meters)),
                SimpleRange("2-3", Offset(0.meters), Offset(5.meters))
            ),
            convertRes(res)
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
        val builder = SimpleGraphBuilder()
        builder.makeNodes(7)
        builder.makeEdge(
            0,
            1,
            100.meters,
            setOf(Pathfinding.Range(Offset(50.meters), Offset(50.meters)))
        )
        builder.makeEdge(1, 4, 100.meters)
        builder.makeEdge(2, 3, 100.meters)
        builder.makeEdge(3, 4, 100000.meters)
        builder.makeEdge(4, 5, 0.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .addBlockedRangeOnEdges { edge -> edge.blockedRanges }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1"), builder.getEdgeLocation("2-3")),
                        listOf(builder.getEdgeLocation("4-5"))
                    )
                )
        val resIDs = res!!.stream().map { x -> x!!.label }.toList()
        Assertions.assertEquals(listOf("2-3", "3-4", "4-5"), resIDs)
    }

    @Test
    fun blockedStartTest() {
        /* Single edge, the start is on a blocked range

        0 -> BLOCKED( -> B -> E -> ) -> 1
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(2)
        builder.makeEdge(
            0,
            1,
            100.meters,
            setOf(Pathfinding.Range(Offset(0.meters), Offset(10.meters)))
        )
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .addBlockedRangeOnEdges { edge -> edge.blockedRanges }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1", 5.meters)),
                        listOf(builder.getEdgeLocation("0-1", 7.meters))
                    )
                )
        Assertions.assertNull(res)
    }

    @Test
    fun pathBetweenBlockedRangesTest() {
        /* Single edge, there are blocked ranges before and after the path

        0 -> BLOCKED() -> B -> E -> BLOCKED() -> 1
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(2)
        builder.makeEdge(
            0,
            1,
            100.meters,
            setOf(
                Pathfinding.Range(Offset(0.meters), Offset(30.meters)),
                Pathfinding.Range(Offset(70.meters), Offset(100.meters))
            )
        )
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .addBlockedRangeOnEdges { edge -> edge.blockedRanges }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1", 40.meters)),
                        listOf(builder.getEdgeLocation("0-1", 50.meters))
                    )
                )
        Assertions.assertNotNull(res)
    }

    @Test
    fun blockedAfterEnd() {
        /* Several edges, the last edge is blocked after the end

        0 -> B -> 1 -> E -> BLOCKED() -> 2
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(3)
        builder.makeEdge(0, 1, 100.meters)
        builder.makeEdge(
            1,
            2,
            100.meters,
            setOf(Pathfinding.Range(Offset(70.meters), Offset(100.meters)))
        )
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .addBlockedRangeOnEdges { edge -> edge.blockedRanges }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1")),
                        listOf(builder.getEdgeLocation("1-2", 50.meters))
                    )
                )
        Assertions.assertNotNull(res)
    }

    @Test
    fun blockedBeforeEnd() {
        /* Several edges, the last edge is blocked before the end

        0 -> B -> 1 -> BLOCKED() -> E -> 2
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(3)
        builder.makeEdge(0, 1, 100.meters)
        builder.makeEdge(
            1,
            2,
            100.meters,
            setOf(Pathfinding.Range(Offset(10.meters), Offset(20.meters)))
        )
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .addBlockedRangeOnEdges { edge -> edge.blockedRanges }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1")),
                        listOf(builder.getEdgeLocation("1-2", 50.meters))
                    )
                )
        Assertions.assertNull(res)
    }

    @Test
    fun severalStartsWithBlockedRange() {
        /* Some starting points are blocked, others are not

        0 -> B1 -> BLOCKED -> B2 -> E -> 1
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(2)
        builder.makeEdge(
            0,
            1,
            100.meters,
            setOf(Pathfinding.Range(Offset(10.meters), Offset(20.meters)))
        )
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .addBlockedRangeOnEdges { edge -> edge.blockedRanges }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(
                            builder.getEdgeLocation("0-1", 10.meters),
                            builder.getEdgeLocation("0-1", 40.meters)
                        ),
                        listOf(builder.getEdgeLocation("0-1", 50.meters))
                    )
                )
        Assertions.assertNotNull(res)
    }

    @Test
    fun overlappingBlockedRanges() {
        /* Blocked ranges overlap

        0 -> + -> -> + -> -> + -> B -> E -> + -> 1
             +  - blocked -  +
                     +  -  blocked -  -  -  +
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(2)
        builder.makeEdge(
            0,
            1,
            100.meters,
            setOf(
                Pathfinding.Range(Offset(10.meters), Offset(50.meters)),
                Pathfinding.Range(Offset(30.meters), Offset(80.meters))
            )
        )
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .addBlockedRangeOnEdges { edge -> edge.blockedRanges }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(builder.getEdgeLocation("0-1", 55.meters)),
                        listOf(builder.getEdgeLocation("0-1", 60.meters))
                    )
                )
        Assertions.assertNull(res)
    }

    @Test
    fun pathfindingDisjointedPaths() {
        /* Two disjointed paths, top one is direct and fastest, bottom one is split

        0 -> B1 ------> E1 -> 1
        2 -> B2 -> 3 -> 4 -> E2 -> 5
         */
        val builder = SimpleGraphBuilder()
        builder.makeNodes(6)
        builder.makeEdge(0, 1, 10000.meters)
        builder.makeEdge(2, 3, 1000.meters)
        builder.makeEdge(3, 4, 1000.meters)
        builder.makeEdge(4, 5, 1000.meters)
        val g = builder.build()
        val res =
            Pathfinding(g)
                .setEdgeToLength { edge -> edge.length }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(
                            builder.getEdgeLocation("0-1", 5000.meters),
                            builder.getEdgeLocation("2-3")
                        ),
                        listOf(
                            builder.getEdgeLocation("0-1", 6999.meters),
                            builder.getEdgeLocation("4-5", 1000.meters)
                        )
                    )
                )
        val resIDs = res!!.stream().map { x -> x!!.label }.toList()
        Assertions.assertEquals(listOf("0-1"), resIDs)
    }

    @ParameterizedTest
    @CsvSource("0, true", "10, false", ", false")
    fun pathfindingTimesOut(timeout: Long?, timesOut: Boolean) {
        val builder = SimpleGraphBuilder()
        builder.makeNodes(2)
        builder.makeEdge(0, 1, 100.meters)
        val g = builder.build()
        val pathfinding =
            Pathfinding(g).setEdgeToLength { edge -> edge.length }.setTimeout(timeout?.toDouble())
        if (!timesOut) {
            val res =
                pathfinding.runPathfindingEdgesOnly(listOf(listOf(builder.getEdgeLocation("0-1"))))
            Assertions.assertNotNull(res)
        } else {
            AssertionsForClassTypes.assertThatThrownBy {
                    pathfinding.runPathfindingEdgesOnly(
                        listOf(listOf(builder.getEdgeLocation("0-1")))
                    )
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
        val secondBlock = infra.addBlock("b", "c")
        val mrspBuilder =
            CachedBlockMRSPBuilder(infra.fullInfra().rawInfra, infra.fullInfra().blockInfra, null)
        val res =
            Pathfinding(GraphAdapter(infra.fullInfra().blockInfra, infra.fullInfra().rawInfra))
                .setEdgeToLength { block -> infra.fullInfra().blockInfra.getBlockLength(block) }
                .setRangeCost { range ->
                    val start = mrspBuilder.getBlockTime(range.edge, range.start)
                    val end = mrspBuilder.getBlockTime(range.edge, range.end)
                    val res = end - start
                    return@setRangeCost res
                }
                .runPathfindingEdgesOnly(
                    listOf(
                        listOf(
                            EdgeLocation(slow, Offset(0.meters)),
                            EdgeLocation(fast, Offset(0.meters)),
                        ),
                        listOf(
                            EdgeLocation(secondBlock, Offset(0.meters)),
                        )
                    )
                )
        Assertions.assertEquals(listOf(fast, secondBlock), res)
    }

    companion object {
        private fun convertRes(res: Pathfinding.Result<Edge, Edge>): List<SimpleRange> {
            return res.ranges
                .stream()
                .map { x -> SimpleRange(x.edge.label, x.start, x.end) }
                .collect(Collectors.toList())
        }
    }
}
