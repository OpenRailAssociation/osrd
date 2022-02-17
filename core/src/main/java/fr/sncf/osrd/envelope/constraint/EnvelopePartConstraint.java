package fr.sncf.osrd.envelope.constraint;

import fr.sncf.osrd.envelope.EnvelopePoint;

public interface EnvelopePartConstraint {
    /** Returns whether the first point of an envelope part satisfies a constraint */
    boolean initCheck(double direction, double position, double speed);

    /** Intersects a segment (start excluded, end included) with this constraint */
    EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed);
}
