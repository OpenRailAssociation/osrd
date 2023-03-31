package fr.sncf.osrd.envelope.part.constraints;

import static fr.sncf.osrd.envelope.EnvelopePhysics.intersectStepWithSpeed;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.EnvelopePoint;

@SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
public class SpeedConstraint implements EnvelopePartConstraint {
    public final double speedConstraint;
    private final EnvelopePartConstraintType type;

    public SpeedConstraint(double speedConstraint,
                           EnvelopePartConstraintType type) {
        this.speedConstraint = speedConstraint;
        this.type = type;
    }

    @Override
    public boolean initCheck(double position, double speed, double direction) {
        return switch (type) {
            case CEILING -> speed <= speedConstraint;
            case FLOOR -> speed >= speedConstraint;
            case EQUAL -> speed == speedConstraint;
        };
    }

    @Override
    public EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed) {
        switch (type) {
            case CEILING:
                if (endSpeed < speedConstraint)
                    return null;
                break;
            case FLOOR:
                if (endSpeed > speedConstraint)
                    return null;
                break;
            case EQUAL:
                if (endSpeed == speedConstraint)
                    return null;
                break;
        }
        var interPosition = intersectStepWithSpeed(startPos, startSpeed, endPos, endSpeed, speedConstraint);
        return new EnvelopePoint(interPosition, speedConstraint);
    }
}
