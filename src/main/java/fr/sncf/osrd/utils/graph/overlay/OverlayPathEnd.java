package fr.sncf.osrd.utils.graph.overlay;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.path.PathEnd;
import fr.sncf.osrd.utils.graph.path.PathNode;

public class OverlayPathEnd<EdgeT extends Edge, OverlayNodeT>
        extends PathEnd<EdgeT, OverlayPathStart<EdgeT, OverlayNodeT>, OverlayPathEnd<EdgeT, OverlayNodeT>> {
    public final OverlayNodeT overlayNode;

    protected OverlayPathEnd(
            double addedCost,
            EdgeT edge,
            EdgeDirection direction,
            double position,
            OverlayNodeT overlayNode,
            PathNode<EdgeT, OverlayPathStart<EdgeT, OverlayNodeT>, OverlayPathEnd<EdgeT, OverlayNodeT>> previous
    ) {
        super(addedCost, edge, direction, position, previous);
        this.overlayNode = overlayNode;
    }
}
