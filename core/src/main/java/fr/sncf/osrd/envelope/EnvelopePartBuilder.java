package fr.sncf.osrd.envelope;

import com.carrotsearch.hppc.DoubleArrayList;

public final class EnvelopePartBuilder implements StepConsumer {
    private final DoubleArrayList positions;
    private final DoubleArrayList speeds;
    private final DoubleArrayList times;
    private final EnvelopePartMeta meta;

    /** Prepares an envelope builder */
    public EnvelopePartBuilder(
            EnvelopePartMeta meta,
            double initialPosition,
            double initialSpeed) {
        this.meta = meta;
        var positions = new DoubleArrayList();
        var speeds = new DoubleArrayList();
        positions.add(initialPosition);
        speeds.add(initialSpeed);
        this.positions = positions;
        this.speeds = speeds;
        this.times = new DoubleArrayList();
    }

    public boolean isEmpty() {
        return positions.isEmpty();
    }

    /** Add a point to the envelope part, computing the step time */
    @Override
    public boolean addStep(double position, double speed) {
        var lastPos = positions.get(positions.size() - 1);
        var lastSpeed = speeds.get(positions.size() - 1);
        var stepTime = EnvelopePhysics.interpolateStepTime(lastPos, position, lastSpeed, speed);
        return addStep(position, speed, stepTime);
    }

    /** Add a point to the envelope part */
    @Override
    public boolean addStep(double position, double speed, double timeDelta) {
        assert !Double.isNaN(position);
        assert !Double.isNaN(speed);
        assert !Double.isNaN(timeDelta);
        assert times.size() == positions.size() - 1;
        var lastPos = positions.get(positions.size() - 1);
        var lastSpeed = speeds.get(positions.size() - 1);
        if (position == lastPos && speed == lastSpeed) {
            assert timeDelta == 0.0;
            return false;
        }

        positions.add(position);
        speeds.add(speed);
        times.add(timeDelta);
        return false;
    }

    private static void reverse(DoubleArrayList arr) {
        for (int i = 0; i < arr.size() / 2; i++) {
            double tmp = arr.get(i);
            arr.set(i, arr.get(arr.size() - 1 - i));
            arr.set(arr.size() - 1 - i, tmp);
        }
    }

    /** Reverse all the pending steps */
    public void reverse() {
        reverse(positions);
        reverse(speeds);
        reverse(times);
    }

    /** Creates an envelope part */
    public EnvelopePart build() {
        return new EnvelopePart(meta, positions.toArray(), speeds.toArray(), times.toArray());
    }

    /** Return the number of steps currently in the envelope part builder*/
    public int stepCount() {
        return times.size();
    }
}
