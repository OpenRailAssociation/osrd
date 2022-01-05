package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.MinEnvelopeBuilder.EnvelopeChangeType.*;

import java.util.ArrayList;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Collections;

public final class MinEnvelopeBuilder {
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
        INTERMEDIATE(1),
        END(2);

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
    public void addPart(EnvelopePart part) {
        changes.add(new EnvelopeChange(part.getBeginPos(), part, BEGIN));
        for (int i = 1; i < part.stepCount(); i++)
            changes.add(new EnvelopeChange(part.getPointPos(i), part, INTERMEDIATE));
        changes.add(new EnvelopeChange(part.getEndPos(), part, END));
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
        currentPartBuilder = new EnvelopePartBuilder(
                newMinPart.meta,
                initialPosition,
                initialSpeed
        );
    }

    private void updateMinPoint(double position) {
        if (activeParts.isEmpty()) {
            assert currentMinPart == null;
            return;
        }

        currentMinSpeed = Double.POSITIVE_INFINITY;
        for (var env : activeParts) {
            var envSpeed = env.interpolateSpeed(position);
            if (envSpeed >= currentMinSpeed)
                continue;

            currentMinSpeed = envSpeed;
            currentMinPart = env;
        }
    }

    /** Build the envelope from all the given parts. This function should be call only once. */
    public Envelope build() {
        // this algorithm tries hard to keep track of what curve is the minimum one at all times.
        // When a new point is met, is only gets added to the curve if it's part of the minimum curve.
        // When the minimum curve changes, there are two cases which can add points which didn't exist before:
        //  - curve intersections
        //  - a new minimum curve which starts below the old minimum (in a disjoint manner)

        // here's a short description of the algorithm:
        //  - iterate over all the events by position first, then by (END, INTERMEDIATE, BEGIN), in order
        //  - keep track of all active curves at a given position
        //  LEFT SIDE
        //  - when a new event arrives, no matter what its type is, we update the min curve, if we already had one:
        //     - we interpolate on all curves, and if the min curve change, we terminate the previous output curve with
        //       the intersection point, which also starts the new min curve
        //  - process all curve ends events for the current position:
        //     - if the current min curve ends, finalize it and set the min curve to null
        //  RIGHT SIDE
        //  - process all intermediate changes for the current position:
        //    - if the change is part of the min curve, add it to the output curve
        //  - process curve starts, adding curves to the active set
        //  - check if the min curve needs to be updated after adding starts
        //
        // we split the process of keeping track of the minimum in 2:

        assert changeIndex == 0;

        Collections.sort(changes);
        while (changeIndex < changes.size()) {
            var currentPosition = changes.get(changeIndex).position;

            updateMinPart(currentPosition);
            processCurveEnds(currentPosition);
            processIntermediate(currentPosition);
            processCurveStarts(currentPosition);
            updateDiscontinuousStart(currentPosition);
        }
        return Envelope.make(buildResult.toArray(new EnvelopePart[0]));
    }

    private void updateDiscontinuousStart(double currentPosition) {
        var oldMinSpeed = currentMinSpeed;
        var oldMinPart = currentMinPart;

        updateMinPoint(currentPosition);

        if (oldMinPart == currentMinPart)
            return;

        /* Terminate the old min part if a new one starts below it
         *  A ---------- B
         *        C ---------- D
         *        ^
         */
        if (oldMinPart != null)
            currentPartBuilder.addStep(currentPosition, oldMinSpeed);
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

    private void processIntermediate(double currentPosition) {
        while (changeIndex < changes.size()) {
            var change = changes.get(changeIndex);
            if (change.type != INTERMEDIATE || change.position > currentPosition)
                return;

            // if there's an intermediate point on the minimum curve, add it
            if (change.part == currentMinPart)
                currentPartBuilder.addStep(currentPosition, currentMinSpeed);
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

    private void updateMinPart(double position) {
        if (currentMinPart == null)
            return;

        var oldMinPart = currentMinPart;
        updateMinPoint(position);

        if (oldMinPart == currentMinPart)
            return;

        /* Compute intersection
         *     C
         *      \
         *  A ---+------- B
         *        \
         *         D
         *         ^
         */
        var intersection = EnvelopePhysics.intersectSteps(currentMinPart, oldMinPart, position);
        currentPartBuilder.addStep(intersection.position, intersection.speed);
        newResultPart(currentMinPart, intersection.position, intersection.speed);
    }
}
