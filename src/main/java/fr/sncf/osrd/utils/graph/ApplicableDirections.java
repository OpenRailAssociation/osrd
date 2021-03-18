package fr.sncf.osrd.utils.graph;

public enum ApplicableDirections {
    NORMAL(new EdgeDirection[]{EdgeDirection.START_TO_STOP}),
    REVERSE(new EdgeDirection[]{EdgeDirection.STOP_TO_START}),
    BOTH(new EdgeDirection[]{EdgeDirection.START_TO_STOP, EdgeDirection.STOP_TO_START});

    public final EdgeDirection[] directionSet;

    ApplicableDirections(EdgeDirection[] directionSet) {
        this.directionSet = directionSet;
    }

    /**
     * Returns the opposite applicable directions
     * @return The opposite applicable directions
     */
    public ApplicableDirections opposite() {
        switch (this) {
            case NORMAL:
                return REVERSE;
            case REVERSE:
                return NORMAL;
            case BOTH:
                return BOTH;
        }
        throw new RuntimeException("impossible switch branch");
    }

    public boolean appliesToNormal() {
        return this != REVERSE;
    }

    public boolean appliesToReverse() {
        return this != NORMAL;
    }
}
