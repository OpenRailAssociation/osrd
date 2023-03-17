package fr.sncf.osrd.envelope.part.constraints;

import fr.sncf.osrd.envelope.EnvelopePoint;

public interface EnvelopePartConstraint {
    /** Returns whether the first point of an envelope part satisfies a constraint */
    boolean initCheck(double position, double speed, double direction);

    /** Intersects a segment (start excluded, end included) with this constraint */
    EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed);
}
