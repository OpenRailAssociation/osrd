package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class BasicPathStart<EdgeT extends Edge>
        extends PathStart<EdgeT, BasicPathStart<EdgeT>, BasicPathEnd<EdgeT>> {
    public BasicPathStart(double cost, EdgeT edge, EdgeDirection direction, double position) {
        super(cost, edge, direction, position);
    }
}
