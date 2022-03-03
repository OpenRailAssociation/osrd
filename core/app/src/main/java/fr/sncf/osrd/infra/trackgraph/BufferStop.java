package fr.sncf.osrd.infra.trackgraph;

/**
 * A stop block prevents trains from going past the end of a track.
 * https://en.wikipedia.org/wiki/Buffer_stop
 */
public class BufferStop extends Waypoint {
    public BufferStop(int index, String id) {
        super(index, id);
    }

    @Override
    public String toString() {
        return String.format("BufferStop { id=%s }", id);
    }
}
