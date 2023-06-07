package fr.sncf.osrd.infra.api;

import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint;

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

    /** Return the first met endpoint along the edge in the given direction */
    public static EdgeEndpoint startEndpoint(Direction dir) {
        if (dir == FORWARD)
            return EdgeEndpoint.BEGIN;
        return EdgeEndpoint.END;
    }

    /** Return the last met endpoint along the edge in the given direction */
    public static EdgeEndpoint endEndpoint(Direction dir) {
        return startEndpoint(dir.opposite());
    }

    /** Returns the opposite direction */
    public Direction opposite() {
        if (this == FORWARD)
            return BACKWARD;
        return FORWARD;
    }
}
