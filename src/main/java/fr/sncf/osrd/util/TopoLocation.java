package fr.sncf.osrd.util;

import fr.sncf.osrd.infra.topological.TopoEdge;

public class TopoLocation {
    public final TopoEdge edge;
    public final double position;

    public TopoLocation(TopoEdge edge, double position) {
        this.edge = edge;
        this.position = position;
    }
}
