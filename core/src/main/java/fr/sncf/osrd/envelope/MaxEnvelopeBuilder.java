package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.MaxEnvelopeBuilder.EnvelopeChangeType.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.ArrayList;
import java.util.Collections;

public final class MaxEnvelopeBuilder {
    // Input
    private final ArrayList<EnvelopeChange> changes = new ArrayList<>();

    // Builder internals
    private EnvelopePart currentMaxPart = null;
    private double currentMaxSpeed = 0.0;

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

    private void newResultPart(EnvelopePart newMaxPart, double initialPosition, double initialSpeed) {
        flushResultPart();
        currentPartBuilder = new EnvelopePartBuilder();
        currentPartBuilder.initEnvelopePart(initialPosition, initialSpeed, 1);
        currentPartBuilder.setAttrs(newMaxPart.getAttrs().values());
    }

    private void updateMaxPoint(double position) {
        if (activeParts.isEmpty()) {
            assert currentMaxPart == null;
            return;
        }

        var oldMaxPart = currentMaxPart;
        currentMaxSpeed = Double.NEGATIVE_INFINITY;
        var currentMaxAcceleration = Double.NEGATIVE_INFINITY;
        // compute the max speed of all active parts at this position
        for (var part : activeParts) {
            var speed = part.interpolateSpeed(position);
            if (speed < currentMaxSpeed)
                continue;
            currentMaxSpeed = speed;
        }
        // if there was an existing oldMaxPart and it is the current maximum speed,
        // it will remain the max part in case of intersection
        if (oldMaxPart != null) {
            var oldMaxSpeed = oldMaxPart.interpolateSpeed(position);
            if (Math.abs(oldMaxSpeed - currentMaxSpeed) < 1E-6)
                return;
        }
        // in case some parts are equal, decide which one takes over by keeping the one with greatest acceleration
        for (var part : activeParts) {
            var speed = part.interpolateSpeed(position);
            if (Math.abs(speed - currentMaxSpeed) < 1E-6) {
                var stepIndex = part.findRight(position);
                var acceleration = part.interpolateAcceleration(stepIndex, position);
                if (acceleration <= currentMaxAcceleration)
                    continue;
                currentMaxAcceleration = acceleration;
                currentMaxPart = part;
            }
        }
    }

    /** Build the envelope from all the given parts. This function should be call only once. */
    public Envelope build() {
        // this algorithm tries hard to keep track of what curve is the maximum one at all times.
        // When a new point is met, is only gets added to the curve if it's part of the maximum curve.
        // When the maximum curve changes, there are two cases which can add points which didn't exist before:
        //  - curve intersections
        //  - a new maximum curve which starts above the old maximum (in a disjoint manner)

        // here's a short description of the algorithm:
        //  - iterate over all the events by position first, then by (END, INTERMEDIATE, BEGIN), in order
        //  - keep track of all active curves at a given position
        //  LEFT SIDE
        //  - when a new event arrives, no matter what its type is, we update the max curve, if we already had one:
        //     - we interpolate on all curves, and if the max curve changes, we terminate the previous output curve with
        //       the intersection point, which also starts the new max curve
        //  - process all curve ends events for the current position:
        //     - if the current max curve ends, finalize it and set the max curve to null
        //  RIGHT SIDE
        //  - process all intermediate changes for the current position:
        //    - if the change is part of the max curve, add it to the output curve
        //  - process curve starts, adding curves to the active set
        //  - check if the max curve needs to be updated after adding starts
        //
        // we split the process of keeping track of the maximum in 2:

        assert changeIndex == 0;

        Collections.sort(changes);
        while (changeIndex < changes.size()) {
            var currentPosition = changes.get(changeIndex).position;

            updateMaxPart(currentPosition);
            processCurveEnds(currentPosition);
            processIntermediate(currentPosition);
            processCurveStarts(currentPosition);
            updateDiscontinuousStart(currentPosition);
        }
        return Envelope.make(buildResult.toArray(new EnvelopePart[0]));
    }

    private void updateDiscontinuousStart(double position) {
        var oldMaxSpeed = currentMaxSpeed;
        var oldMaxPart = currentMaxPart;

        updateMaxPoint(position);

        if (oldMaxPart == currentMaxPart)
            return;

        /* Terminate the old max part if a new one starts above it
         *        C ---------- D
         *        ^
         *  A ---------- B
         */
        if (oldMaxPart != null)
            currentPartBuilder.addStep(position, oldMaxSpeed);
        newResultPart(currentMaxPart, position, currentMaxSpeed);
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

            // if there's an intermediate point on the Maximum curve, add it
            if (change.part == currentMaxPart)
                currentPartBuilder.addStep(currentPosition, currentMaxSpeed);
            changeIndex++;
        }
    }

    private void processCurveEnds(double currentPosition) {
        while (changeIndex < changes.size()) {
            var change = changes.get(changeIndex);
            if (change.type != END || change.position > currentPosition)
                return;
            activeParts.remove(change.part);

            // if the current Max part ends, finalize it in the output as well
            if (change.part == currentMaxPart) {
                assert currentMaxPart != null;
                currentPartBuilder.addStep(currentPosition, currentMaxSpeed);
                flushResultPart();
                currentMaxPart = null;
            }
            changeIndex++;
        }
    }

    private void updateMaxPart(double position) {
        if (currentMaxPart == null)
            return;

        var oldMaxPart = currentMaxPart;
        updateMaxPoint(position);

        if (oldMaxPart == currentMaxPart)
            return;

        /* Compute intersection
         *         D
         *        /
         *  A ---+------- B
         *      /
         *     C
         *     ^
         */
        var intersection = EnvelopePhysics.intersectSteps(currentMaxPart, oldMaxPart, position);
        currentPartBuilder.addStep(intersection.position, intersection.speed);
        newResultPart(currentMaxPart, intersection.position, intersection.speed);
    }
}
