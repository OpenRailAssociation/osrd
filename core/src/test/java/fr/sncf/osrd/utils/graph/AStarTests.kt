package fr.sncf.osrd.utils.graph

import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator
import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.graph.AStarHeuristic
import fr.sncf.osrd.graph.GraphAdapter
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder.Companion.DEFAULT_MAX_ROLLING_STOCK_SPEED
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class AStarTests {
    /**
     * We try to find a path from a point on the center-west of the infra to the east most point.
     * The path is almost a geographic line, so a good heuristic should help. We run the pathfinding
     * with and without a heuristic and ensure that we visit more blocks without heuristic.
     */
    @Test
    @Throws(Exception::class)
    fun lessBlocksVisitedWithHeuristic() {

        /*                     ---------- DUMMY INFRA ----------
         *                                                               k0
         *                                                              /
         *                                                            j0
         *                                                           /
         *                                                         i0
         *                                                        /
         *                                                   g0-h0
         *                                                  /
         *                                       c1-d1-e1-f1
         *                                      /           \
         *                             d3-c3-a-b             g1-h1-i1
         *                            /         \                    \
         *                          e3           c2                   j1-k1
         *                         /               \
         *                       f3                 d2
         *                                            \
         *                                             e2
         *                                               \
         *                                                f2
         */

        val dummyInfra = DummyInfra()
        val fullDummyInfra = dummyInfra.fullInfra()

        val pointsList =
            hashMapOf(
                "a" to Point(.0, .0),
                "b" to Point(1.0, .0),
                "c1" to Point(2.0, 1.0),
                "d1" to Point(3.0, 1.0),
                "e1" to Point(4.0, 1.0),
                "f1" to Point(5.0, 1.0),
                "g0" to Point(6.0, 2.0),
                "h0" to Point(7.0, 2.0),
                "i0" to Point(8.0, 3.0),
                "j0" to Point(9.0, 4.0),
                "k0" to Point(10.0, 6.0),
                "g1" to Point(6.0, .0),
                "h1" to Point(7.0, .0),
                "i1" to Point(8.0, .0),
                "j1" to Point(9.0, -1.0),
                "k1" to Point(10.0, -1.0),
                "c2" to Point(2.0, -1.0),
                "d2" to Point(3.0, -2.0),
                "e2" to Point(4.0, -4.0),
                "f2" to Point(6.0, -5.0),
                "c3" to Point(-1.0, .0),
                "d3" to Point(-2.0, .0),
                "e3" to Point(-3.0, -1.0),
                "f3" to Point(-4.0, -2.0)
            )

        dummyInfra.addDetectorGeoPoints(pointsList)

        val routePointsA = listOf("a", "b", "c1", "d1", "e1", "f1", "g0", "h0", "i0", "j0", "k0")
        val routePointsB = listOf("f1", "g1", "h1", "i1", "j1", "k1")
        val routePointsC = listOf("b", "c2", "d2", "e2", "f2")
        val routePointsD = listOf("a", "c3", "d3", "e3", "f3")

        val startBlock = dummyInfra.addBlockChain(routePointsA).first()
        dummyInfra.addBlockChain(routePointsB)
        val endBlock = dummyInfra.addBlockChain(routePointsC).last()
        dummyInfra.addBlockChain(routePointsD)

        // ---------- ----------- ----------

        val origin = mutableSetOf(PathfindingEdgeLocationId(startBlock, Offset(0.meters)))
        val destination = mutableSetOf(PathfindingEdgeLocationId(endBlock, Offset(100.meters)))

        val remainingDistanceEstimator =
            RemainingDistanceEstimator(
                fullDummyInfra.blockInfra,
                fullDummyInfra.rawInfra,
                destination,
                0.meters
            )
        val seenWithHeuristic = HashSet<BlockId>()
        val seenWithoutHeuristic = HashSet<BlockId>()
        val mrspBuilder =
            CachedBlockMRSPBuilder(fullDummyInfra.rawInfra, fullDummyInfra.blockInfra, null)
        Pathfinding(GraphAdapter(fullDummyInfra.blockInfra, fullDummyInfra.rawInfra))
            .setEdgeToLength { blockId -> fullDummyInfra.blockInfra.getBlockLength(blockId) }
            .setRangeCost { range ->
                mrspBuilder.getBlockTime(range.edge, range.end) -
                    mrspBuilder.getBlockTime(range.edge, range.start)
            }
            .setRemainingDistanceEstimator(
                listOf(
                    AStarHeuristic { block, offset ->
                        seenWithHeuristic.add(block)
                        remainingDistanceEstimator.apply(block, offset).meters /
                            DEFAULT_MAX_ROLLING_STOCK_SPEED
                    }
                )
            )
            .runPathfinding(listOf<Set<PathfindingEdgeLocationId<Block>>>(origin, destination))
        Pathfinding(GraphAdapter(fullDummyInfra.blockInfra, fullDummyInfra.rawInfra))
            .setEdgeToLength { blockId -> fullDummyInfra.blockInfra.getBlockLength(blockId) }
            .setRemainingDistanceEstimator(
                listOf(
                    AStarHeuristic { block, _ ->
                        seenWithoutHeuristic.add(block)
                        0.0
                    }
                )
            )
            .runPathfinding(listOf<Set<PathfindingEdgeLocationId<Block>>>(origin, destination))
        Assertions.assertTrue(seenWithHeuristic.size < seenWithoutHeuristic.size)
    }
}
