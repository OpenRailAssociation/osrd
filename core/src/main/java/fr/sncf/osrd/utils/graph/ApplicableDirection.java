package fr.sncf.osrd.utils.graph;

public enum ApplicableDirection {
    START_TO_STOP(new EdgeDirection[]{EdgeDirection.START_TO_STOP}),
    STOP_TO_START(new EdgeDirection[]{EdgeDirection.STOP_TO_START}),
    BOTH(new EdgeDirection[]{EdgeDirection.START_TO_STOP, EdgeDirection.STOP_TO_START});

    public final EdgeDirection[] directionSet;

    ApplicableDirection(EdgeDirection[] directionSet) {
        this.directionSet = directionSet;
    }

    /**
     * Returns the opposite applicable directions
     * @return The opposite applicable directions
     */
    public ApplicableDirection opposite() {
        switch (this) {
            case START_TO_STOP:
                return STOP_TO_START;
            case STOP_TO_START:
                return START_TO_STOP;
            case BOTH:
                return BOTH;
        }
        throw new RuntimeException("impossible switch branch");
    }

    public boolean appliesToNormal() {
        return this != STOP_TO_START;
    }

    public boolean appliesToReverse() {
        return this != START_TO_STOP;
    }
}
