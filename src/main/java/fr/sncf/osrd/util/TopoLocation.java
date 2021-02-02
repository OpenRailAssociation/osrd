package fr.sncf.osrd.util;

import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.topological.TopoEdge;

public class TopoLocation {
    public final TopoEdge edge;
    public final double position;

    public TopoLocation(TopoEdge edge, double position) {
        this.edge = edge;
        this.position = position;
    }

    /**
     * Creates a TopoLocation on an edge along a direction
     * @param edge the edge
     * @param dir the direction on the edge
     * @param offset the offset along the direction
     * @return a location on the edge
     */
    public static TopoLocation fromDirection(TopoEdge edge, EdgeDirection dir, double offset) {
        if (dir == EdgeDirection.START_TO_STOP)
            return new TopoLocation(edge, offset);
        return new TopoLocation(edge, edge.length - offset);
    }
}
