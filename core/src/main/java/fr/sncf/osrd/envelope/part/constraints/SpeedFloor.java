package fr.sncf.osrd.envelope.part.constraints;

import static fr.sncf.osrd.envelope.EnvelopePhysics.intersectStepWithSpeed;

import fr.sncf.osrd.envelope.EnvelopePoint;

public class SpeedFloor implements EnvelopePartConstraint {
    public final double floor;

    public SpeedFloor(double floor) {
        this.floor = floor;
    }

    @Override
    public boolean initCheck(double direction, double position, double speed) {
        return speed >= floor;
    }

    @Override
    public EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed) {
        if (endSpeed > floor)
            return null;
        var interPosition = intersectStepWithSpeed(startPos, startSpeed, endPos, endSpeed, floor);
        return new EnvelopePoint(interPosition, floor);
    }
}