package fr.sncf.osrd.util;

import fr.sncf.osrd.util.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.TrackSection;

public class TopoLocation {
    public final TrackSection edge;
    public final double position;

    public TopoLocation(TrackSection edge, double position) {
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
    public static TopoLocation fromDirection(TrackSection edge, EdgeDirection dir, double offset) {
        if (dir == EdgeDirection.START_TO_STOP)
            return new TopoLocation(edge, offset);
        return new TopoLocation(edge, edge.length - offset);
    }
}
