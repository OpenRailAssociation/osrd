package fr.sncf.osrd.utils.graph.overlay;

import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.path.PathStart;

public class OverlayPathStart<EdgeT extends Edge, OverlayNodeT>
        extends PathStart<EdgeT, OverlayPathStart<EdgeT, OverlayNodeT>, OverlayPathEnd<EdgeT, OverlayNodeT>> {
    public final OverlayNodeT overlayNode;

    /** Create the starting point of a path in the overlay */
    public OverlayPathStart(
            EdgeT edge,
            EdgeDirection direction,
            double position,
            OverlayNodeT overlayNode
    ) {
        super(0, edge, direction, position);
        this.overlayNode = overlayNode;
    }
}
