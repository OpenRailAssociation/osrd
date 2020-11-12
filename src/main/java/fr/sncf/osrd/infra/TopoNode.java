package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

/**
 * A node in the topological infrastructure graph.
 * Node types must inherit from TopoNode and add their
 */
public abstract class TopoNode extends AbstractNode<TopoEdge> {
    private final String id;

    public TopoNode(String id) {
        this.id = id;
    }
}
