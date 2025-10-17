package fr.sncf.osrd.envelope.part.constraints;

import fr.sncf.osrd.envelope.EnvelopePoint;

public interface EnvelopePartConstraint {
    /** Returns whether the first point of an envelope part satisfies a constraint */
    boolean initCheck(double position, double speed, double direction);

    /** Returns whether the constraint sets a minimum value on the simulation speed. */
    boolean isFloor();

    /** Returns whether the constraint sets a position limit. */
    boolean hasPositionConstraint();

    /** Intersects a segment (start excluded, end included) with this constraint */
    EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed);
}
