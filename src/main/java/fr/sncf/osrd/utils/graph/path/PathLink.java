package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

/** A link to a previous path chain node, which defines a path section. */
public class PathLink<
        EdgeT extends Edge,
        PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
        >
        extends PathNode<EdgeT, PathStartT, PathEndT> {
    public final PathNode<EdgeT, PathStartT, PathEndT> previous;

    protected PathLink(
            double cost,
            EdgeT edge,
            EdgeDirection direction,
            double position,
            PathNode<EdgeT, PathStartT, PathEndT> previous
    ) {
        super(cost, edge, direction, position);
        this.previous = previous;
    }

    @Override
    public final Type getType() {
        return Type.INTERMEDIATE;
    }

    @Override
    public final PathNode<EdgeT, PathStartT, PathEndT> getPrevious() {
        return previous;
    }
}
