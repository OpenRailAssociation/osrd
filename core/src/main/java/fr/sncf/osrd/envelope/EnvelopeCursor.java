package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.function.Predicate;


public class EnvelopeCursor implements EnvelopePosition {
    /** The number of times this cursor was moved */
    private int revision;

    public enum NextStepResult {
        NEXT_STEP,
        NEXT_PART,
        NEXT_REACHED_END,
    }

    /** The envelope the cursor iterates over */
    public final Envelope envelope;
    /** Whether the builder works in reverse */
    public final boolean reverse;

    /** Should always be envelope.get(partIndex), or null */
    private EnvelopePart part;
    /** The index of part inside the base envelope, or -1 if the end was reached */
    private int partIndex;
    /** The current index inside part, or -1 if the end was reached */
    private int stepIndex;
    /** The position in the envelope, or NaN if the end was reached */
    private double position;

    public boolean hasReachedEnd() {
        return partIndex == -1;
    }

    /** Creates a new envelope cursor */
    public EnvelopeCursor(Envelope envelope, boolean reverse) {
        this.envelope = envelope;
        this.reverse = reverse;
        this.partIndex = firstIndex(this.envelope.size());
        this.part = envelope.get(this.partIndex);
        this.stepIndex = firstIndex(this.part.stepCount());
        this.position = getStepBeginPos();
        this.revision = 0;
    }

    public static EnvelopeCursor forward(Envelope envelope) {
        return new EnvelopeCursor(envelope, false);
    }

    public static EnvelopeCursor backward(Envelope envelope) {
        return new EnvelopeCursor(envelope, true);
    }

    public int getRevision() {
        return revision;
    }

    public int getStepIndex() {
        assert !hasReachedEnd();
        return stepIndex;
    }

    public int getPartIndex() {
        assert !hasReachedEnd();
        return partIndex;
    }

    public double getPosition() {
        assert !hasReachedEnd();
        return position;
    }

    public EnvelopePart getPart() {
        assert !hasReachedEnd();
        return part;
    }

    private int firstIndex(int size) {
        if (reverse)
            return size - 1;
        return 0;
    }

    private int lastIndex(int size) {
        if (reverse)
            return 0;
        return size - 1;
    }

    /** Returns the next index, or -1 if there is no valid next index */
    private int nextIndex(int cur, int size) {
        if (reverse) {
            int res = cur - 1;
            if (res < 0)
                return -1;
            return res;
        } else {
            int res = cur + 1;
            if (res >= size)
                return -1;
            return res;
        }
    }

    /** Cuts the envelope part we're iterating over, taking direction into account */
    public EnvelopePart[] smartSlice(
            int beginPartIndex, int beginStepIndex, double beginPosition,
            int endPartIndex, int endStepIndex, double endPosition
    ) {
        if (reverse)
            return envelope.smartSlice(
                    endPartIndex, endStepIndex, endPosition,
                    beginPartIndex, beginStepIndex, beginPosition
            );
        return envelope.smartSlice(
                beginPartIndex, beginStepIndex, beginPosition,
                endPartIndex, endStepIndex, endPosition
        );
    }

    private double getStepBeginPos(EnvelopePart part, int stepIndex) {
        if (reverse)
            return part.getEndPos(stepIndex);
        return part.getBeginPos(stepIndex);
    }

    public double getStepBeginPos() {
        return getStepBeginPos(part, stepIndex);
    }

    private double getStepEndPos(EnvelopePart part, int stepIndex) {
        if (reverse)
            return part.getBeginPos(stepIndex);
        return part.getEndPos(stepIndex);
    }

    public double getStepEndPos() {
        return getStepEndPos(part, stepIndex);
    }

    public double getStepBeginSpeed() {
        return getStepBeginSpeed(part, stepIndex);
    }

    private double getStepBeginSpeed(EnvelopePart part, int stepIndex) {
        if (reverse)
            return part.getEndSpeed(stepIndex);
        return part.getBeginSpeed(stepIndex);
    }

    public double getStepEndSpeed() {
        return getStepEndSpeed(part, stepIndex);
    }

    private double getStepEndSpeed(EnvelopePart part, int stepIndex) {
        if (reverse)
            return part.getBeginSpeed(stepIndex);
        return part.getEndSpeed(stepIndex);
    }

    private double getPartBeginPos() {
        return getStepBeginPos(part, firstIndex(part.stepCount()));
    }

    private double getPartEndPos() {
        return getStepEndPos(part, lastIndex(part.stepCount()));
    }

    /** Compares positions in a direction away manner. */
    public double comparePos(double a, double b) {
        if (reverse)
            return b - a;
        return a - b;
    }

    /** Moves the cursor to the end of the envelope */
    public void moveToEnd() {
        part = null;
        partIndex = -1;
        stepIndex = -1;
        setPosition(Double.NaN);
    }

    public int nextPartIndex() {
        return nextIndex(partIndex, envelope.size());
    }

    /** Moves the cursor to the next part */
    public boolean nextPart() {
        if (hasReachedEnd())
            return false;

        partIndex = nextPartIndex();
        if (partIndex == -1) {
            moveToEnd();
            return false;
        }
        part = envelope.get(partIndex);
        stepIndex = firstIndex(part.stepCount());
        setPosition(getStepBeginPos());
        return true;
    }

    /** Moves the cursor to the next step */
    public NextStepResult nextStep() {
        if (hasReachedEnd())
            return NEXT_REACHED_END;

        assert partIndex != -1;
        assert stepIndex != -1;
        stepIndex = nextIndex(stepIndex, part.stepCount());
        if (stepIndex == -1)
            return nextPart() ? NEXT_PART : NEXT_REACHED_END;
        setPosition(getStepBeginPos());
        return NEXT_STEP;
    }

    public double interpolateSpeed() {
        return part.interpolateSpeed(stepIndex, position);
    }

    /**
     * Moves the cursor to this position, by looking for the envelope part and step which contain this position
     * @return whether a step with this position was found
     */
    public boolean findPosition(double newPosition) {
        if (hasReachedEnd())
            return false;

        // the new position can only move the cursor forward
        assert comparePos(newPosition, this.position) >= 0;

        // find the EnvelopePart which contains the new position
        while (comparePos(getPartEndPos(), newPosition) < 0)
            if (!nextPart())
                return false;

        // make sure the new position is within the bounds of the found part
        assert comparePos(getPartBeginPos(), newPosition) <= 0;

        // now that we found the envelope part, find the exact step
        while (comparePos(getStepEndPos(), newPosition) < 0)
            if (nextStep() == NEXT_REACHED_END)
                return false;

        // ensure the new position is in the step
        assert comparePos(getStepBeginPos(), newPosition) <= 0;

        setPosition(newPosition);
        return true;
    }

    /** Attempts to find a step which matches the given predicate */
    public boolean findStep(Envelope.TransitionPredicate predicate) {
        if (hasReachedEnd())
            return false;

        do {
            if (predicate.test(getStepBeginPos(), getStepBeginSpeed(), getStepEndPos(), getStepEndSpeed()))
                return true;
        } while (nextStep() != NEXT_REACHED_END);
        return false;
    }

    /** Set the position and bumps the revision */
    private void setPosition(double newPosition) {
        position = newPosition;
        revision++;
    }

    /** Attempts to find a transition between envelope parts which matches a predicate */
    public boolean findPartTransition(Envelope.TransitionPredicate predicate) {
        if (hasReachedEnd())
            return false;

        do {
            // find the next part
            var nextPartInd = nextPartIndex();
            if (nextPartInd == -1)
                return false;
            var nextPart = envelope.get(nextPartInd);

            var curEndIndex = lastIndex(part.stepCount());
            var nextStartIndex = firstIndex(nextPart.stepCount());

            // get the coordinates of the last point of this envelope and the first point of the next envelope
            var curPos = getStepEndPos(part, curEndIndex);
            var curSpeed = getStepEndSpeed(part, curEndIndex);
            var nextPos = getStepEndPos(nextPart, nextStartIndex);
            var nextSpeed = getStepEndSpeed(nextPart, nextStartIndex);

            // move the cursor to the end of the current part
            this.stepIndex = curEndIndex;
            setPosition(curPos);

            if (predicate.test(curPos, curSpeed, nextPos, nextSpeed))
                return true;
        } while (nextPart());
        return false;
    }

    /** Attempts to find a part which matches a predicate */
    public boolean findPart(Predicate<EnvelopePart> predicate) {
        if (hasReachedEnd())
            return false;

        do {
            if (predicate.test(part))
                return true;
        } while (nextPart());
        return false;
    }
}
