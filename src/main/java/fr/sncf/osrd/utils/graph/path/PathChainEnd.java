package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

/** The end of a path chain */
public class PathChainEnd<
        EdgeT extends Edge,
        PathStartT extends PathChainStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathChainEnd<EdgeT, PathStartT, PathEndT>
        > extends PathChainNode<EdgeT, PathStartT, PathEndT> {
    public final PathChainNode<EdgeT, PathStartT, PathEndT> previous;

    protected PathChainEnd(
            double cost,
            EdgeT edge,
            EdgeDirection direction,
            double position,
            PathChainNode<EdgeT, PathStartT, PathEndT> previous
    ) {
        super(cost, edge, direction, position);
        this.previous = previous;
    }

    @Override
    public final PathChainNode<EdgeT, PathStartT, PathEndT> getPrevious() {
        return previous;
    }

    @Override
    public final Type getType() {
        return Type.END;
    }
}
