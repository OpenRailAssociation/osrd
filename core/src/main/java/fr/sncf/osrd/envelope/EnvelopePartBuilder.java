package fr.sncf.osrd.envelope;

import com.carrotsearch.hppc.DoubleArrayList;

public final class EnvelopePartBuilder {
    private final DoubleArrayList positions = new DoubleArrayList();
    private final DoubleArrayList speeds = new DoubleArrayList();
    private final EnvelopeType type;
    private final boolean isCoasting;

    public EnvelopePartBuilder(EnvelopeType type, boolean isCoasting) {
        this.type = type;
        this.isCoasting = isCoasting;
    }

    public boolean isEmpty() {
        return positions.isEmpty();
    }

    /** Add a point to the envelope part */
    public void add(double position, double speed) {
        if (!positions.isEmpty()) {
            var lastPos = positions.get(positions.size() - 1);
            var lastSpeed = speeds.get(positions.size() - 1);
            if (position == lastPos && speed == lastSpeed)
                return;
            assert position > lastPos;
        }
        positions.add(position);
        speeds.add(speed);
    }

    public EnvelopePart build() {
        return new EnvelopePart(type, positions.toArray(), speeds.toArray(), isCoasting);
    }
}
