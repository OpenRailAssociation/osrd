package fr.sncf.osrd.envelope.constraint;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.EnvelopePhysics;
import fr.sncf.osrd.envelope.EnvelopePoint;

public class PositionRange implements EnvelopePartConstraint {
    public final double rangeBegin;
    public final double rangeEnd;

    public PositionRange(double rangeBegin, double rangeEnd) {
        this.rangeBegin = rangeBegin;
        this.rangeEnd = rangeEnd;
    }

    @Override
    public boolean initCheck(double direction, double position, double speed) {
        return position >= rangeBegin && position <= rangeEnd;
    }

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public EnvelopePoint stepCheck(double startPos, double startSpeed, double endPos, double endSpeed) {
        if (endPos > rangeBegin && endPos < rangeEnd)
            return null;

        if (endPos == rangeBegin || endPos == rangeEnd)
            return new EnvelopePoint(endPos, endSpeed);

        double interPos;
        if (endPos < rangeBegin)
            interPos = rangeBegin;
        else
            interPos = rangeEnd;

        var offset = interPos - startPos;
        var speed = EnvelopePhysics.interpolateStepSpeed(startPos, endPos, startSpeed, endSpeed, offset);
        return new EnvelopePoint(interPos, speed);
    }
}
