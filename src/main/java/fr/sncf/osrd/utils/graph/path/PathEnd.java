package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

/** The end of a path chain */
public class PathEnd<
        EdgeT extends Edge,
        PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
        > extends PathNode<EdgeT, PathStartT, PathEndT> {
    public final PathNode<EdgeT, PathStartT, PathEndT> previous;

    protected PathEnd(
            double cost,
            EdgeT edge,
            EdgeDirection direction,
            double position,
            PathNode<EdgeT, PathStartT, PathEndT> previous
    ) {
        super(previous.cost + cost, edge, direction, position);
        this.previous = previous;
    }

    @Override
    public final PathNode<EdgeT, PathStartT, PathEndT> getPrevious() {
        return previous;
    }

    @Override
    public final Type getType() {
        return Type.END;
    }
}
