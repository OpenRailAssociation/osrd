package fr.sncf.osrd.envelope.part;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.areSpeedsEqual;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.EnvelopeAttr;
import fr.sncf.osrd.envelope.EnvelopePhysics;
import fr.sncf.osrd.envelope.EnvelopePoint;
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraint;
import fr.sncf.osrd.envelope_utils.DoubleUtils;

public final class ConstrainedEnvelopePartBuilder implements InteractiveEnvelopePartConsumer {
    public EnvelopePartConstraint[] constraints;
    public final EnvelopePartConsumer sink;
    public int lastIntersection = -1;
    private double lastPos;
    private double lastSpeed;
    private double direction;

    public boolean hadIntersection() {
        return lastIntersection != -1;
    }

    /** Creates a new constrained envelope part consumer */
    public ConstrainedEnvelopePartBuilder(EnvelopePartConsumer sink, EnvelopePartConstraint... constraints) {
        this.sink = sink;
        this.constraints = constraints;
        this.lastPos = Double.NaN;
        this.lastSpeed = Double.NaN;
        this.direction = Double.NaN;
    }

    private EnvelopePoint intersect(double position, double speed) {
        // check if this step intersects with any constraint
        EnvelopePoint nextInter = null;
        int nextInterConstraint = -1;
        for (int i = 0; i < constraints.length; i++) {
            var constraint = constraints[i];
            var curInter = constraint.stepCheck(lastPos, lastSpeed, position, speed);
            // if this constraint does not intersect, skip it
            if (curInter == null) continue;
            // if this is the first intersection, or it is closer than the previous one, keep it
            if (nextInter != null && DoubleUtils.dirCompare(direction, curInter.position, nextInter.position) >= 0)
                continue;
            nextInter = curInter;
            nextInterConstraint = i;
        }
        lastIntersection = nextInterConstraint;
        return nextInter;
    }

    @Override
    public boolean initEnvelopePart(double position, double speed, double direction) {
        for (var constraint : constraints) if (!constraint.initCheck(position, speed, direction)) return false;
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
        assert !hadIntersection();

        // try to find an intersection with some constraint
        var intersection = intersect(position, speed);

        // if an intersection was found, cut the step
        if (intersection != null) {
            position = intersection.position;
            speed = intersection.speed;
        }

        lastPos = position;
        lastSpeed = speed;
        sink.addStep(position, speed);
        return intersection == null;
    }

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean addStep(double position, double speed, double timeDelta) {
        assert !hadIntersection();

        // try to find an intersection with some constraint
        var intersection = intersect(position, speed);

        // if an intersection was found, cut the step
        if (intersection != null) {
            position = intersection.position;
            speed = intersection.speed;
            if (position == lastPos) {
                assert areSpeedsEqual(speed, lastSpeed);
                speed = lastSpeed;
                timeDelta = 0;
            } else timeDelta = EnvelopePhysics.interpolateStepTime(lastPos, position, lastSpeed, speed);
        }

        lastPos = position;
        lastSpeed = speed;
        sink.addStep(position, speed, timeDelta);
        return intersection == null;
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
