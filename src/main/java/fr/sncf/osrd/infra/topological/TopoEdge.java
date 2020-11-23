package fr.sncf.osrd.infra.topological;

import fr.sncf.osrd.infra.graph.AbstractEdge;
import fr.sncf.osrd.infra.Track;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * An edge in the topological graph.
 */
public final class TopoEdge extends AbstractEdge<TopoNode> {
    public final Track track;
    public final String id;
    public final double length;

    public final double startNodeTrackPosition;
    public final double endNodeTrackPosition;

    /**
     * Create a new topological edge.
     * This constructor is private, as the edge should also be registered into the nodes.
     */
    private TopoEdge(
            Track track,
            String id,
            TopoNode startNode,
            TopoNode endNode,
            double startNodeTrackPosition,
            double endNodeTrackPosition,
            double length
    ) {
        super(startNode, endNode);
        this.track = track;
        this.id = id;
        this.length = length;
        this.startNodeTrackPosition = startNodeTrackPosition;
        this.endNodeTrackPosition = endNodeTrackPosition;
    }

    /**
     * Link two nodes with a new edge.
     *
     * @param startNode The start node of the edge
     * @param startNodeRegister The function to call to register the edge with the start node
     * @param endNode The end node of the edge
     * @param endNodeRegister The function to call to register the edge with the end node
     * @param track the track to add the edge onto
     * @param id A unique identifier for the edge
     * @param length The length of the edge, in meters
     * @return A new edge
     */
    public static TopoEdge link(
            TopoNode startNode,
            Function<TopoEdge, TopoNode> startNodeRegister,
            TopoNode endNode,
            Function<TopoEdge, TopoNode> endNodeRegister,
            double startNodePosition,
            double endNodePosition,
            Track track,
            String id,
            double length
    ) {
        var edge = new TopoEdge(track, id, startNode, endNode, startNodePosition, endNodePosition, length);
        var startNodeReg = startNodeRegister.apply(edge);
        var endNodeReg = endNodeRegister.apply(edge);
        assert startNode == startNodeReg;
        assert endNode == endNodeReg;
        return edge;
    }

    @Override
    public void freeze() {
    }
}
