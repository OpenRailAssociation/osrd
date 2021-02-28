package fr.sncf.osrd.utils.graph.path;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public abstract class PathChainNode<
        EdgeT extends Edge,
        PathStartT extends PathChainStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathChainEnd<EdgeT, PathStartT, PathEndT>
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

    public abstract PathChainNode<EdgeT, PathStartT, PathEndT> getPrevious();

    protected PathChainNode(
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
    public PathChainNode<EdgeT, PathStartT, PathEndT> chain(
            double additionalCost,
            EdgeT edge,
            EdgeDirection direction,
            double position
    ) {
        assert this.getClass() != PathChainEnd.class;
        return new PathChainLink<>(cost + additionalCost, edge, direction, position, this);
    }
}
