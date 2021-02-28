package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class BasicPathChainEnd<EdgeT extends Edge>
        extends PathChainEnd<EdgeT, BasicPathChainStart<EdgeT>, BasicPathChainEnd<EdgeT>> {
    public BasicPathChainEnd(
            double cost,
            EdgeT edge,
            EdgeDirection direction,
            double position,
            PathChainNode<EdgeT, BasicPathChainStart<EdgeT>, BasicPathChainEnd<EdgeT>> previous
    ) {
        super(cost, edge, direction, position, previous);
    }
}
