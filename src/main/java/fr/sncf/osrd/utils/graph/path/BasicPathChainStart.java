package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class BasicPathChainStart<EdgeT extends Edge>
        extends PathChainStart<EdgeT, BasicPathChainStart<EdgeT>, BasicPathChainEnd<EdgeT>> {
    public BasicPathChainStart(double cost, EdgeT edge, EdgeDirection direction, double position) {
        super(cost, edge, direction, position);
    }
}
