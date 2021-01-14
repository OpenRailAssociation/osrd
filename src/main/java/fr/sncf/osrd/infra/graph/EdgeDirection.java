package fr.sncf.osrd.infra.graph;

/** Encodes a direction along an edge. */
public enum EdgeDirection {
    START_TO_STOP(0),
    STOP_TO_START(1);

    public final int id;

    EdgeDirection(int id) {
        this.id = id;
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
