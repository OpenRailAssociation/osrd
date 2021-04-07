package fr.sncf.osrd.utils.graph.overlay;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.Node;
import fr.sncf.osrd.utils.graph.path.PathNode;

public class OverlayPathNode<
        EdgeT extends Edge,
        OverlayNodeT extends Node
        > extends PathNode<EdgeT, OverlayPathNode<EdgeT, OverlayNodeT>> {
    public final EdgeDirection direction;
    public final OverlayNodeT overlayNode;

    /** Build start node */
    public OverlayPathNode(EdgeT edge, double position, EdgeDirection direction, OverlayNodeT overlayNode) {
        super(0, edge, position, Type.START, null);
        this.direction = direction;
        this.overlayNode = overlayNode;
    }

    protected OverlayPathNode(
            double cost,
            EdgeT edge,
            double position,
            EdgeDirection direction,
            Type type,
            OverlayPathNode<EdgeT, OverlayNodeT> previous,
            OverlayNodeT overlayNode
    ) {
        super(cost, edge, position, type, previous);
        this.direction = direction;
        this.overlayNode = overlayNode;
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
    public OverlayPathNode<EdgeT, OverlayNodeT> chain(
            double additionalCost,
            EdgeT edge,
            double position,
            EdgeDirection direction
    ) {
        assert type != Type.END;
        return new OverlayPathNode<>(cost + additionalCost, edge, position, direction, Type.INTERMEDIATE, this, null);
    }

    /** Adds a final end node at the end of a path */
    public OverlayPathNode<EdgeT, OverlayNodeT> end(
            double additionalCost,
            EdgeT edge,
            double position,
            EdgeDirection direction,
            OverlayNodeT node
    ) {
        assert type != Type.END;
        return new OverlayPathNode<>(cost + additionalCost, edge, position, direction, Type.END, this, node);
    }
}
