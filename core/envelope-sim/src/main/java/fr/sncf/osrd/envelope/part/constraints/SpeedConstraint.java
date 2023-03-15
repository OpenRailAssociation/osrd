package fr.sncf.osrd.envelope.part.constraints;

import static fr.sncf.osrd.envelope.EnvelopePhysics.intersectStepWithSpeed;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.*;

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
        if (type == FLOOR)
            return speed >= speedConstraint;
        if (type == MAINTAIN_SPEED)
            return speed == speedConstraint;
        return false;   // default return
    }

    @Override
    public EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed) {
        if (type == CEILING && endSpeed < speedConstraint)
            return null;
        if (type == FLOOR && endSpeed > speedConstraint)
            return null;
        if (type == MAINTAIN_SPEED && endSpeed == speedConstraint)
            return null;

        var interPosition = intersectStepWithSpeed(startPos, startSpeed, endPos, endSpeed, speedConstraint);
        return new EnvelopePoint(interPosition, speedConstraint);
    }
}
