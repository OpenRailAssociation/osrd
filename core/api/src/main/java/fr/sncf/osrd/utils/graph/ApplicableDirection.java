package fr.sncf.osrd.utils.graph;

import fr.sncf.osrd.railjson.schema.common.RJSApplicableDirection;

public enum ApplicableDirection {
    NORMAL(new EdgeDirection[]{EdgeDirection.START_TO_STOP}),
    REVERSE(new EdgeDirection[]{EdgeDirection.STOP_TO_START}),
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

    /** Parses from railjson */
    public static ApplicableDirection parse(RJSApplicableDirection origin) {
        switch (origin) {
            case BOTH:
                return BOTH;
            case NORMAL:
                return NORMAL;
            case REVERSE:
                return REVERSE;
        }
        throw new RuntimeException("unknown applicable direction type");
    }
}
