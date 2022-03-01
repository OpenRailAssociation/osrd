package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.MRSPEnvelopeBuilder.EnvelopeChangeType.*;

import java.util.ArrayList;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import java.util.Collections;

/** Given a set of overlapping envelope parts, this structure finds the minimum speed envelope. */
public final class MRSPEnvelopeBuilder {
    // Input
    private final ArrayList<EnvelopeChange> changes = new ArrayList<>();

    // Builder internals
    private EnvelopePart currentMinPart = null;
    private double currentMinSpeed = Double.POSITIVE_INFINITY;

    private final ArrayList<EnvelopePart> buildResult = new ArrayList<>();
    private EnvelopePartBuilder currentPartBuilder = null;
    private final ArrayList<EnvelopePart> activeParts = new ArrayList<>();
    private int changeIndex = 0;

    enum EnvelopeChangeType {
        BEGIN(0),
        END(1);

        public final int priority;

        EnvelopeChangeType(int priority) {
            this.priority = priority;
        }
    }

    @SuppressFBWarnings(
            value = {"EQ_COMPARETO_USE_OBJECT_EQUALS"},
            justification = "This class has a natural ordering that is inconsistent with equals")
    private static final class EnvelopeChange implements Comparable<EnvelopeChange> {
        public final double position;
        public final EnvelopePart part;
        public final EnvelopeChangeType type;

        EnvelopeChange(double position, EnvelopePart part, EnvelopeChangeType type) {
            this.position = position;
            this.part = part;
            this.type = type;
        }

        @Override
        public int compareTo(EnvelopeChange o) {
            var offDelta = Double.compare(position, o.position);
            if (offDelta != 0)
                return offDelta;

            return Integer.compare(type.priority, o.type.priority);
        }
    }

    /** Add an envelope part to the envelope */
    public MRSPEnvelopeBuilder addPart(EnvelopePart part) {
        assert part.stepCount() == 1;
        assert part.getMinSpeed() == part.getMaxSpeed();
        changes.add(new EnvelopeChange(part.getBeginPos(), part, BEGIN));
        changes.add(new EnvelopeChange(part.getEndPos(), part, END));
        return this;
    }

    private void flushResultPart() {
        if (currentPartBuilder == null)
            return;
        if (currentPartBuilder.isEmpty())
            return;
        buildResult.add(currentPartBuilder.build());
        currentPartBuilder = null;
    }

    private void newResultPart(EnvelopePart newMinPart, double initialPosition, double initialSpeed) {
        flushResultPart();
        currentPartBuilder = new EnvelopePartBuilder();
        currentPartBuilder.initEnvelopePart(initialPosition, initialSpeed, 1);
        currentPartBuilder.setAttrs(newMinPart.getAttrs().values());
    }

    /** Build the envelope from all the given parts. This function should be call only once. */
    public Envelope build() {
        // this algorithm only works on constant speed envelope parts.
        // we sort the beginning and end of each envelope part

        assert changeIndex == 0;

        Collections.sort(changes);
        while (changeIndex < changes.size()) {
            var currentPosition = changes.get(changeIndex).position;

            processCurveEnds(currentPosition);
            processCurveStarts(currentPosition);
            updateMinPart(currentPosition);
        }
        return Envelope.make(buildResult.toArray(new EnvelopePart[0]));
    }

    private void updateMinPart(double currentPosition) {
        if (activeParts.isEmpty()) {
            assert currentMinPart == null;
            return;
        }

        // find the minimum curve
        var oldMinSpeed = currentMinSpeed;
        var oldMinPart = currentMinPart;
        currentMinSpeed = Double.POSITIVE_INFINITY;
        for (var env : activeParts) {
            var envSpeed = env.getMinSpeed();
            if (envSpeed >= currentMinSpeed)
                continue;

            currentMinSpeed = envSpeed;
            currentMinPart = env;
        }

        if (oldMinPart == currentMinPart)
            return;

        /* Terminate the old min part if a new one starts below it
         *  A ---------- B
         *        C ---------- D
         *        ^
         */
        if (oldMinPart != null)
            currentPartBuilder.addStep(currentPosition, oldMinSpeed);
        assert currentMinPart != null;
        newResultPart(currentMinPart, currentPosition, currentMinSpeed);
    }

    private void processCurveStarts(double currentPosition) {
        while (changeIndex < changes.size()) {
            var change = changes.get(changeIndex);
            if (change.type != BEGIN || change.position > currentPosition)
                return;
            activeParts.add(change.part);
            changeIndex++;
        }
    }

    private void processCurveEnds(double currentPosition) {
        while (changeIndex < changes.size()) {
            var change = changes.get(changeIndex);
            if (change.type != END || change.position > currentPosition)
                return;
            activeParts.remove(change.part);

            // if the current min part ends, finalize it in the output as well
            if (change.part == currentMinPart) {
                assert currentMinPart != null;
                currentPartBuilder.addStep(currentPosition, currentMinSpeed);
                flushResultPart();
                currentMinPart = null;
            }
            changeIndex++;
        }
    }
}
