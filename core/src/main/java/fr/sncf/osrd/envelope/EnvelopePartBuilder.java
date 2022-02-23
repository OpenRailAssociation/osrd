package fr.sncf.osrd.envelope;

import com.carrotsearch.hppc.DoubleArrayList;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public class EnvelopePartBuilder implements EnvelopePartConsumer {
    private final DoubleArrayList positions;
    private final DoubleArrayList speeds;
    private final DoubleArrayList times;
    private EnvelopePartMeta meta;
    private double direction;

    private double lastPos;
    private double lastSpeed;

    /** Prepares an envelope builder */
    public EnvelopePartBuilder() {
        this.positions = new DoubleArrayList();
        this.speeds = new DoubleArrayList();
        this.times = new DoubleArrayList();
        this.meta = null;
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
    public void setEnvelopePartMeta(EnvelopePartMeta meta) {
        this.meta = meta;
    }

    private static void reverse(DoubleArrayList arr) {
        for (int i = 0; i < arr.size() / 2; i++) {
            double tmp = arr.get(i);
            arr.set(i, arr.get(arr.size() - 1 - i));
            arr.set(arr.size() - 1 - i, tmp);
        }
    }

    /** Creates an envelope part */
    public EnvelopePart build() {
        if (direction < 0) {
            reverse(positions);
            reverse(speeds);
            reverse(times);
        }
        return new EnvelopePart(meta, positions.toArray(), speeds.toArray(), times.toArray());
    }

    /** Return the number of steps currently in the envelope part builder*/
    public int stepCount() {
        return times.size();
    }
}
