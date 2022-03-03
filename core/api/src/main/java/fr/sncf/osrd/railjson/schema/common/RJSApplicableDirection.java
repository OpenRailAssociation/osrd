package fr.sncf.osrd.railjson.schema.common;

public enum RJSApplicableDirection {
    NORMAL(new RJSEdgeDirection[]{RJSEdgeDirection.START_TO_STOP}),
    REVERSE(new RJSEdgeDirection[]{RJSEdgeDirection.STOP_TO_START}),
    BOTH(new RJSEdgeDirection[]{RJSEdgeDirection.START_TO_STOP, RJSEdgeDirection.STOP_TO_START});

    public final RJSEdgeDirection[] directionSet;

    RJSApplicableDirection(RJSEdgeDirection[] directionSet) {
        this.directionSet = directionSet;
    }

    /**
     * Returns the opposite applicable directions
     * @return The opposite applicable directions
     */
    public RJSApplicableDirection opposite() {
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
