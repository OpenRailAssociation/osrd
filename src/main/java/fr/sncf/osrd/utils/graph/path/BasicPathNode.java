package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;

public class BasicPathNode<EdgeT extends Edge> extends PathNode<EdgeT, BasicPathNode<EdgeT>> {
    /** Build start node */
    public BasicPathNode(EdgeT edge, double position) {
        super(0, edge, position, Type.START, null);
    }

    protected BasicPathNode(double cost, EdgeT edge, double position, Type type, BasicPathNode<EdgeT> previous) {
        super(cost, edge, position, type, previous);
    }

    /** Adds a new intermediary node at the end of a path */
    public BasicPathNode<EdgeT> chain(
            double additionalCost,
            EdgeT edge,
            double position
    ) {
        assert type != Type.END;
        return new BasicPathNode<>(cost + additionalCost, edge, position, Type.INTERMEDIATE, this);
    }

    /** Adds a final end node at the end of a path */
    public BasicPathNode<EdgeT> end(
            double additionalCost,
            EdgeT edge,
            double position
    ) {
        assert type != Type.END;
        return new BasicPathNode<>(cost + additionalCost, edge, position, Type.END, this);
    }
}
