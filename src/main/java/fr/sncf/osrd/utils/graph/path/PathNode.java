package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public abstract class PathNode<
        EdgeT extends Edge,
        PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
        > {
    /** The total cost since the beginning of the path */
    public final double cost;
    /** The edge this path node is on */
    public final EdgeT edge;
    public final EdgeDirection direction;
    public final double position;

    public enum Type {
        START,
        INTERMEDIATE,
        END,
    }

    public abstract Type getType();

    public abstract PathNode<EdgeT, PathStartT, PathEndT> getPrevious();

    protected PathNode(
            double cost,
            EdgeT edge,
            EdgeDirection direction,
            double position
    ) {
        this.cost = cost;
        this.edge = edge;
        this.direction = direction;
        this.position = position;
    }

    /** Checks whether some point would be reached by continuing this path without changing edge */
    public boolean isEdgePositionAhead(EdgeT targetEdge, double targetPosition) {
        if (targetEdge != this.edge)
            return false;
        if (direction == EdgeDirection.START_TO_STOP)
            return targetPosition >= this.position;
        return targetPosition <= this.position;
    }


    /** Adds a new intermediary node at the end of a path */
    public PathNode<EdgeT, PathStartT, PathEndT> chain(
            double additionalCost,
            EdgeT edge,
            EdgeDirection direction,
            double position
    ) {
        assert this.getClass() != PathEnd.class;
        return new PathLink<>(cost + additionalCost, edge, direction, position, this);
    }
}
