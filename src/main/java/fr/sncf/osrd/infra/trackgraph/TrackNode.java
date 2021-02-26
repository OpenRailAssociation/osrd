package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.Node;

/**
 * A node in the topological infrastructure graph.
 */
@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public abstract class TrackNode extends Node {
    public final String id;

    public TrackNode(int index, String id) {
        super(index);
        this.id = id;
    }
}
