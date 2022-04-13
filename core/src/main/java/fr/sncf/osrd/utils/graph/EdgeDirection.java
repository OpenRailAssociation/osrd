package fr.sncf.osrd.utils.graph;

/** Encodes a direction along an edge. */
public enum EdgeDirection {
    START_TO_STOP(0),
    STOP_TO_START(1);

    public final int id;

    EdgeDirection(int id) {
        this.id = id;
    }

    /** Parse an ApplicableDirection into EdgeDirection */
    public static EdgeDirection from(ApplicableDirection dir) {
        switch (dir) {
            case BOTH:
                return null;
            case START_TO_STOP:
                return START_TO_STOP;
            case STOP_TO_START:
                return STOP_TO_START;
        }
        throw new RuntimeException("invalid applicable direction");
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

    /** Compose the stacking up of directions: going in reverse on a reverse edge is just like normal */
    public EdgeDirection compose(EdgeDirection other) {
        if (this == other)
            return START_TO_STOP;
        return STOP_TO_START;
    }
}
