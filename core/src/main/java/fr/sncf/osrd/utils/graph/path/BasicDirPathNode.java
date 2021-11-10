package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class BasicDirPathNode<EdgeT extends Edge> extends PathNode<EdgeT, BasicDirPathNode<EdgeT>> {
    public final EdgeDirection direction;

    /** Build start node */
    public BasicDirPathNode(EdgeT edge, double position, EdgeDirection direction) {
        super(0, edge, position, Type.START, null);
        this.direction = direction;
    }

    protected BasicDirPathNode(
            double cost,
            EdgeT edge,
            double position,
            EdgeDirection direction,
            Type type,
            BasicDirPathNode<EdgeT> previous
    ) {
        super(cost, edge, position, type, previous);
        this.direction = direction;
    }

    /** Adds a new intermediary node at the end of a path */
    public BasicDirPathNode<EdgeT> chain(
            double additionalCost,
            EdgeT edge,
            double position,
            EdgeDirection direction
    ) {
        assert type != Type.END;
        return new BasicDirPathNode<>(cost + additionalCost, edge, position, direction, Type.INTERMEDIATE, this);
    }

    /** Adds a final end node at the end of a path */
    public BasicDirPathNode<EdgeT> end(
            double additionalCost,
            EdgeT edge,
            double position,
            EdgeDirection direction
    ) {
        assert type != Type.END;
        return new BasicDirPathNode<>(cost + additionalCost, edge, position, direction, Type.END, this);
    }
}
