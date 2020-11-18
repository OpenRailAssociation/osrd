package fr.sncf.osrd.infra.graph;

/** Encodes a direction along an edge. */
public enum EdgeDirection {
    START_TO_STOP(1),
    STOP_TO_START(-1);

    public final int delta;

    EdgeDirection(int delta) {
        this.delta = delta;
    }
}
