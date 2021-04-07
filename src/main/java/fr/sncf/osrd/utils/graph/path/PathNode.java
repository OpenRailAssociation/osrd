package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;

public abstract class PathNode<EdgeT extends Edge, NodeT extends PathNode<EdgeT, NodeT>> {
    /** The total cost since the beginning of the path */
    public final double cost;
    /** The edge this path node is on */
    public final EdgeT edge;
    public final double position;
    public final Type type;
    private final NodeT previous;

    public enum Type {
        START,
        INTERMEDIATE,
        END,
    }

    public NodeT getPrevious() {
        return previous;
    }

    protected PathNode(
            double cost,
            EdgeT edge,
            double position,
            Type type,
            NodeT previous
    ) {
        this.cost = cost;
        this.edge = edge;
        this.position = position;
        this.type = type;
        this.previous = previous;
    }
}
