package fr.sncf.osrd.graph

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.graph.extendLookaheadUntil
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
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
        if (node.infraExplorer.getLookahead().size > 0) {
            extended.add(node.infraExplorer.clone())
        } else {
            extended.addAll(extendLookaheadUntil(node.infraExplorer, 1))
        }
        for (newPath in extended) {
            if (newPath.getLookahead().size == 0) continue
            newPath.moveForward()
            val newEdge = PathfindingEdge(newPath)
            res.add(newEdge)
        }
        return res
    }
}
