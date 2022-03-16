package fr.sncf.osrd.new_infra.api;

import fr.sncf.osrd.utils.graph.EdgeDirection;

/** Encodes a direction in a one dimension space */
public enum Direction {
    FORWARD(1),
    BACKWARD(-1);

    public final double sign;

    Direction(double sign) {
        this.sign = sign;
    }

    /** Converts an EdgeDirection into a Direction (START_TO_STOP -> FORWARD) */
    public static Direction fromEdgeDir(EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return FORWARD;
        return BACKWARD;
    }

    /** Returns the opposite direction */
    public Direction opposite() {
        if (this == FORWARD)
            return BACKWARD;
        return FORWARD;
    }
}
