package fr.sncf.osrd.utils.graph

import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator
import fr.sncf.osrd.graph.AStarHeuristic
import fr.sncf.osrd.graph.GraphAdapter
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.Helpers.convertRouteLocation
import fr.sncf.osrd.utils.Helpers.fullInfraFromRJS
import fr.sncf.osrd.utils.Helpers.getExampleInfra
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class AStarTests {
    /** We try to find a path from a point on the center-west of the infra to the east most point.
     * The path is almost a geographic line, so a good heuristic should help. We run the pathfinding
     * with and without a heuristic and ensure that we visit more blocks without heuristic.
     */
    @Test
    @Throws(Exception::class)
    fun lessBlocksVisitedWithHeuristic() {
        val infra = fullInfraFromRJS(getExampleInfra("small_infra/infra.json"))
        val origin = mutableSetOf(convertRouteLocation(infra, "rt.DA2->DA5", 0.meters))
        val destination = mutableSetOf(convertRouteLocation(infra, "rt.DH2->buffer_stop.7", 0.meters))
        val remainingDistanceEstimator = RemainingDistanceEstimator(
            infra.blockInfra, infra.rawInfra,
            destination, 0.0
        )
        val seenWithHeuristic = HashSet<BlockId>()
        val seenWithoutHeuristic = HashSet<BlockId>()
        Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
            .setEdgeToLength { blockId ->
                infra.blockInfra.getBlockLength(
                    blockId
                ).distance
            }
            .setRemainingDistanceEstimator(
                listOf(
                    AStarHeuristic { block, offset ->
                        seenWithHeuristic.add(block)
                        remainingDistanceEstimator.apply(block, offset)
                    })
            )
            .runPathfinding(listOf<Set<EdgeLocation<StaticIdx<Block>>>>(origin, destination))
        Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
            .setEdgeToLength { blockId ->
                infra.blockInfra.getBlockLength(
                    blockId
                ).distance
            }
            .setRemainingDistanceEstimator(
                listOf(
                    AStarHeuristic { block, _ ->
                        seenWithoutHeuristic.add(block)
                        0.0
                    })
            )
            .runPathfinding(listOf<Set<EdgeLocation<StaticIdx<Block>>>>(origin, destination))
        Assertions.assertTrue(seenWithHeuristic.size < seenWithoutHeuristic.size)
    }
}
