package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

/**
 * A stop block prevents trains from going past the end of a track.
 * https://en.wikipedia.org/wiki/Buffer_stop
 */
@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public class BufferStop extends TrackNode {
    public final TrackSection edge;

    BufferStop(TrackGraph graph, int index, String id, TrackSection edge) {
        super(index, id);
        graph.registerNode(this);
        this.edge = edge;
    }
}
