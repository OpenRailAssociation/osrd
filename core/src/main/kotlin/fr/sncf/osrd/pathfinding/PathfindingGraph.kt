package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.graph.Graph
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.graph.TargetsOnEdge
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.extendLookaheadUntil
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorer
import java.util.ArrayList
import java.util.HashSet
import java.util.Objects

data class PathfindingEdge(val infraExplorer: InfraExplorer) {
    val block = infraExplorer.getCurrentBlock()
    val length = infraExplorer.getCurrentBlockLength()

    override fun equals(other: Any?): Boolean {
        return if (other !is PathfindingEdge) false
        else
            this.infraExplorer.getLastEdgeIdentifier() ==
                other.infraExplorer.getLastEdgeIdentifier()
    }

    override fun hashCode(): Int {
        return Objects.hash(infraExplorer.getLastEdgeIdentifier())
    }
}

class PathfindingGraph : Graph<PathfindingEdge, PathfindingEdge, Block> {
    override fun getEdgeEnd(edge: PathfindingEdge): PathfindingEdge {
        return edge
    }

    override fun getAdjacentEdges(node: PathfindingEdge): Collection<PathfindingEdge> {
        val res = ArrayList<PathfindingEdge>()
        val extended = mutableListOf<InfraExplorer>()
        if (node.infraExplorer.getLookahead().isNotEmpty()) {
            extended.add(node.infraExplorer.clone())
        } else {
            extended.addAll(extendLookaheadUntil(node.infraExplorer, 1))
        }
        for (newPath in extended) {
            if (newPath.getLookahead().isEmpty()) continue
            newPath.moveForward()
            val newEdge = PathfindingEdge(newPath)
            res.add(newEdge)
        }
        return res
    }
}

fun getStartLocations(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    waypoints: ArrayList<Collection<EdgeLocation<BlockId, Block>>>,
    constraints: List<PathfindingConstraint<Block>>,
): Collection<EdgeLocation<PathfindingEdge, Block>> {
    val res = mutableListOf<EdgeLocation<PathfindingEdge, Block>>()
    val firstStep = waypoints[0]
    val steps = waypoints.map { STDCMStep(it) }
    for (location in firstStep) {
        val infraExplorers =
            initInfraExplorer(
                rawInfra,
                blockInfra,
                location,
                steps = steps,
                constraints = constraints,
            )
        val extended = infraExplorers.flatMap { extendLookaheadUntil(it, 1) }
        for (explorer in extended) {
            val edge = PathfindingEdge(explorer)
            res.add(EdgeLocation(edge, location.offset))
        }
    }
    return res
}

fun getTargetsOnEdges(
    waypoints: ArrayList<Collection<EdgeLocation<BlockId, Block>>>
): List<TargetsOnEdge<PathfindingEdge, Block>> {
    val targetsOnEdges = ArrayList<TargetsOnEdge<PathfindingEdge, Block>>()
    for (i in 1 until waypoints.size) {
        targetsOnEdges.add { edge: PathfindingEdge ->
            val res = HashSet<EdgeLocation<PathfindingEdge, Block>>()
            for (target in waypoints[i]) {
                if (target.edge == edge.block) res.add(EdgeLocation(edge, target.offset))
            }
            res
        }
    }
    return targetsOnEdges
}
