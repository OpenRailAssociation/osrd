package fr.sncf.osrd.envelope.part.constraints;

import static fr.sncf.osrd.envelope.EnvelopePhysics.intersectStepWithSpeed;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import fr.sncf.osrd.envelope.EnvelopePoint;

public class SpeedConstraint implements EnvelopePartConstraint {
    public final double speedConstraint;
    private final EnvelopePartConstraintType type;

    public SpeedConstraint(double speedConstraint,
                           EnvelopePartConstraintType type) {
        this.speedConstraint = speedConstraint;
        this.type = type;
    }

    @Override
    public boolean initCheck(double direction, double position, double speed) {
        if (type == CEILING)
            return speed <= speedConstraint;
        else
            return speed >= speedConstraint;
    }

    @Override
    public EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed) {
        if (type == CEILING && endSpeed < speedConstraint)
            return null;
        if (type == FLOOR && endSpeed > speedConstraint)
            return null;
        var interPosition = intersectStepWithSpeed(startPos, startSpeed, endPos, endSpeed, speedConstraint);
        return new EnvelopePoint(interPosition, speedConstraint);
    }
}
