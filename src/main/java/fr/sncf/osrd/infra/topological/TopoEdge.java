package fr.sncf.osrd.infra.topological;

import fr.sncf.osrd.infra.branching.Branch;
import fr.sncf.osrd.infra.graph.AbstractEdge;

import java.util.function.Function;

/**
 * An edge in the topological graph.
 */
public final class TopoEdge extends AbstractEdge<TopoNode> {
    public final String id;
    public final double length;

    public final Branch branch;
    public final double startBranchPosition;
    public final double endBranchPosition;

    /**
     * Create a new topological edge.
     * This constructor is private, as the edge should also be registered into the nodes.
     */
    private TopoEdge(
            String id,
            TopoNode startNode,
            TopoNode endNode,
            double length,
            Branch branch,
            double startBranchPosition,
            double endBranchPosition
    ) {
        super(startNode.getIndex(), endNode.getIndex());
        this.id = id;
        this.length = length;
        this.branch = branch;
        this.startBranchPosition = startBranchPosition;
        this.endBranchPosition = endBranchPosition;
    }

    /**
     * Link two nodes with a new edge.
     *
     * @param startNode The start node of the edge
     * @param startNodeRegister The function to call to register the edge with the start node
     * @param endNode The end node of the edge
     * @param endNodeRegister The function to call to register the edge with the end node
     * @param id A unique identifier for the edge
     * @param length The length of the edge, in meters
     * @return A new edge
     */
    public static TopoEdge link(
            TopoNode startNode,
            TopoNode endNode,
            String id,
            double length,
            Branch branch,
            double startBranchPosition,
            double endBranchPosition
    ) {
        return new TopoEdge(id, startNode, endNode, length, branch, startBranchPosition, endBranchPosition);
    }

    @Override
    public void freeze() {
    }
}
