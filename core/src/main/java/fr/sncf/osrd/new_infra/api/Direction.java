package fr.sncf.osrd.new_infra.api;

/** Encodes a direction in a one dimension space */
public enum Direction {
    FORWARD(1),
    BACKWARD(-1);

    public final double sign;

    Direction(double sign) {
        this.sign = sign;
    }

    /** Returns the opposite direction */
    public Direction opposite() {
        if (this == FORWARD)
            return BACKWARD;
        return FORWARD;
    }
}
