package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.AbstractNode;

/**
 * A node in the topological infrastructure graph.
 */
@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public abstract class TrackNode extends AbstractNode<TrackSection> {
    public final String id;

    public TrackNode(String id) {
        this.id = id;
    }
}
