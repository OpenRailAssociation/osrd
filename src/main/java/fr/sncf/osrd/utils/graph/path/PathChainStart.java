package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

/** The starting point of a path chain */
public class PathChainStart<
        EdgeT extends Edge,
        PathStartT extends PathChainStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathChainEnd<EdgeT, PathStartT, PathEndT>
        > extends PathChainNode<EdgeT, PathStartT, PathEndT> {
    public PathChainStart(double cost, EdgeT edge, EdgeDirection direction, double position) {
        super(cost, edge, direction, position);
    }

    @Override
    public final Type getType() {
        return Type.START;
    }

    @Override
    public final PathChainNode<EdgeT, PathStartT, PathEndT> getPrevious() {
        return null;
    }
}
