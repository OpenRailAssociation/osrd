package fr.sncf.osrd.infra.topological;

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

    public BufferStop(String id, TrackSection edge) {
        super(id);
        this.edge = edge;
    }

    @Override
    public void freeze() {
    }

    @Override
    public boolean isFrozen() {
        return true;
    }
}
