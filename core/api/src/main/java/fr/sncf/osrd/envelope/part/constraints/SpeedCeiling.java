package fr.sncf.osrd.envelope.part.constraints;

import fr.sncf.osrd.envelope.EnvelopePoint;

import static fr.sncf.osrd.envelope.EnvelopePhysics.intersectStepWithSpeed;

public class SpeedCeiling implements EnvelopePartConstraint {
    public final double ceiling;

    public SpeedCeiling(double ceiling) {
        this.ceiling = ceiling;
    }

    @Override
    public boolean initCheck(double direction, double position, double speed) {
        return speed <= ceiling;
    }

    @Override
    public EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed) {
        if (endSpeed < ceiling)
            return null;
        var interPosition = intersectStepWithSpeed(startPos, startSpeed, endPos, endSpeed, ceiling);
        return new EnvelopePoint(interPosition, ceiling);
    }
}
