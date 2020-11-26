package fr.sncf.osrd.infra.topological;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.AbstractNode;

/**
 * A node in the topological infrastructure graph.
 * Node types must inherit from TopoNode and add their
 */
@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public abstract class TopoNode extends AbstractNode<TopoEdge> {
    public final String id;

    public TopoNode(String id) {
        this.id = id;
    }
}
