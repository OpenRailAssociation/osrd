package fr.sncf.osrd.envelope.part;

import com.carrotsearch.hppc.DoubleArrayList;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.EnvelopeAttr;
import fr.sncf.osrd.envelope.EnvelopePhysics;
import java.util.HashMap;
import java.util.Map;

public class EnvelopePartBuilder implements EnvelopePartConsumer {
    private final DoubleArrayList positions;
    private final DoubleArrayList speeds;
    private final DoubleArrayList times;
    private final Map<Class<? extends EnvelopeAttr>, EnvelopeAttr> attrs;
    private double direction;

    private double lastPos;
    private double lastSpeed;

    /** Prepares an envelope builder */
    public EnvelopePartBuilder() {
        this.positions = new DoubleArrayList();
        this.speeds = new DoubleArrayList();
        this.times = new DoubleArrayList();
        this.attrs = new HashMap<>();
        this.direction = Double.NaN;
    }

    public boolean isEmpty() {
        return positions.size() < 2;
    }

    private void addPoint(double position, double speed) {
        assert !Double.isNaN(position);
        assert !Double.isNaN(speed);
        this.positions.add(position);
        this.speeds.add(speed);
        this.lastPos = position;
        this.lastSpeed = speed;
    }

    @Override
    public void initEnvelopePart(double position, double speed, double direction) {
        assert !Double.isNaN(direction);
        assert isEmpty();
        addPoint(position, speed);
        this.direction = direction;
    }

    /** Add a point to the envelope part, computing the step time */
    @Override
    public void addStep(double position, double speed) {
        var stepTime = EnvelopePhysics.interpolateStepTime(lastPos, position, lastSpeed, speed);
        addStep(position, speed, stepTime);
    }

    /** Add a point to the envelope part */
    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public void addStep(double position, double speed, double timeDelta) {
        assert !Double.isNaN(position);
        assert !Double.isNaN(speed);
        assert !Double.isNaN(timeDelta);
        assert times.size() == positions.size() - 1;
        if (position == lastPos && speed == lastSpeed) {
            assert timeDelta == 0.0;
            return;
        }

        addPoint(position, speed);
        times.add(timeDelta);
    }

    @Override
    public <T extends EnvelopeAttr> void setAttr(T attr) {
        assert attr != null : "called setAttr with attr == null";
        attrs.put(attr.getAttrType(), attr);
    }

    @Override
    public void setAttrs(Iterable<EnvelopeAttr> newAttrs) {
        for (var attr : newAttrs)
            attrs.put(attr.getAttrType(), attr);
    }

    private static void reverse(double[] arr) {
        for (int i = 0; i < arr.length / 2; i++) {
            double tmp = arr[i];
            arr[i] = arr[arr.length - 1 - i];
            arr[arr.length - 1 - i] = tmp;
        }
    }

    /** Creates an envelope part */
    public EnvelopePart build() {
        var positions = this.positions.toArray();
        var speeds = this.speeds.toArray();
        var times = this.times.toArray();
        if (direction < 0) {
            reverse(positions);
            reverse(speeds);
            reverse(times);
        }
        return new EnvelopePart(attrs, positions, speeds, times);
    }

    /** Return the number of steps currently in the envelope part builder*/
    public int stepCount() {
        return times.size();
    }
}
