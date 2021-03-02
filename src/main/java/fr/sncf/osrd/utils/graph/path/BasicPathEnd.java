package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class BasicPathEnd<EdgeT extends Edge>
        extends PathEnd<EdgeT, BasicPathStart<EdgeT>, BasicPathEnd<EdgeT>> {
    public BasicPathEnd(
            double cost,
            EdgeT edge,
            EdgeDirection direction,
            double position,
            PathNode<EdgeT, BasicPathStart<EdgeT>, BasicPathEnd<EdgeT>> previous
    ) {
        super(cost, edge, direction, position, previous);
    }
}
