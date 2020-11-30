package fr.sncf.osrd.infra.graph;

/** Encodes a direction along an edge. */
public enum EdgeDirection {
    START_TO_STOP(1),
    STOP_TO_START(-1);

    public final int delta;

    EdgeDirection(int delta) {
        this.delta = delta;
    }

    /**
     * Gets the opposite of this direction
     * @return this opposite of this direction
     */
    public EdgeDirection opposite() {
        if (this == START_TO_STOP)
            return STOP_TO_START;
        return START_TO_STOP;
    }
}
