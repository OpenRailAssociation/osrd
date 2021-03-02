package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

/** The starting point of a path chain */
public class PathStart<
        EdgeT extends Edge,
        PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
        > extends PathNode<EdgeT, PathStartT, PathEndT> {
    public PathStart(double cost, EdgeT edge, EdgeDirection direction, double position) {
        super(cost, edge, direction, position);
    }

    @Override
    public final Type getType() {
        return Type.START;
    }

    @Override
    public final PathNode<EdgeT, PathStartT, PathEndT> getPrevious() {
        return null;
    }
}
