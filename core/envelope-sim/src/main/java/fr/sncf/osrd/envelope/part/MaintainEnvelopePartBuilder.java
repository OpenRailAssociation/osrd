package fr.sncf.osrd.envelope.part;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.EnvelopeAttr;
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraint;

public final class MaintainEnvelopePartBuilder implements InteractiveEnvelopePartConsumer {
    public EnvelopePartConstraint[] constraints;
    public final EnvelopePartConsumer sink;
    public int lastIntersection = -1;
    private double lastPos;
    private double lastSpeed;
    private double direction;

    /** Creates a new constrained envelope part consumer */
    public MaintainEnvelopePartBuilder(EnvelopePartConsumer sink, EnvelopePartConstraint... constraints) {
        this.sink = sink;
        this.constraints = constraints;
        this.lastPos = Double.NaN;
        this.lastSpeed = Double.NaN;
        this.direction = Double.NaN;
    }

    @Override
    public boolean initEnvelopePart(double position, double speed, double direction) {
        for (var constraint : constraints)
            if (!constraint.initCheck(direction, position, speed))
                return false;
        this.lastPos = position;
        this.lastSpeed = speed;
        this.direction = direction;
        sink.initEnvelopePart(position, speed, direction);
        return true;
    }

    @Override
    public double getLastPos() {
        return lastPos;
    }

    @Override
    public double getLastSpeed() {
        return lastSpeed;
    }

    @Override
    public boolean addStep(double position, double speed) {
        for (var constraint : constraints)
            if (constraint.stepCheck(lastPos,lastSpeed,position,speed) != null)
                return false;
        this.lastPos = position;
        this.lastSpeed = speed;
        sink.addStep(position, speed);
        return true;
    }

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean addStep(double position, double speed, double timeDelta) {
        return addStep(position, speed);
    }

    @Override
    public <T extends EnvelopeAttr> void setAttr(T attr) {
        sink.setAttr(attr);
    }

    @Override
    public void setAttrs(Iterable<EnvelopeAttr> attrs) {
        sink.setAttrs(attrs);
    }
}

