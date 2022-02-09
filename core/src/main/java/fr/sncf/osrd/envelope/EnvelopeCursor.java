package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeCursor.NextStepResult.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.CmpOperator;
import java.util.function.Predicate;


public class EnvelopeCursor {
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
    /** The speed at the current position, or NaN if it should be interpolated */
    private double speed;

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
        this.speed = Double.NaN;
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

    public double getStepLength() {
        return getStepEndPos() - getStepBeginPos();
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

    /** Returns the end position of the envelope */
    public double getEnvelopeEndPos() {
        if (reverse)
            return envelope.getBeginPos();
        return envelope.getEndPos();
    }

    /** Returns the speed at the end of the envelope, where "end" depends on cursor direction */
    public double getEnvelopeEndSpeed() {
        if (reverse)
            return envelope.getBeginSpeed();
        return envelope.getEndSpeed();
    }

    public int getEnvelopeLastPartIndex() {
        return lastIndex(envelope.size());
    }

    public EnvelopePart getEnvelopeLastPart() {
        return envelope.get(getEnvelopeLastPartIndex());
    }

    public int getEnvelopeLastStepIndex() {
        return lastIndex(getEnvelopeLastPart().stepCount());
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

    /** Moves the cursor to the beginning of the next step */
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

    /** Returns the speed at the location of the cursor */
    public double getSpeed() {
        if (!Double.isNaN(speed))
            return speed;
        return part.interpolateSpeed(stepIndex, position);
    }

    /**
     * Moves the cursor to this position, by looking for the envelope part and step which contain this position
     * @return whether a step with this position was found
     */
    public boolean findPosition(double newPosition) {
        if (hasReachedEnd())
            return false;

        assert comparePos(newPosition, this.position) >= 0 : "the new position can only move the cursor forward";

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
        assert comparePos(newPosition, getStepEndPos()) <= 0;

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

    /** Set the position / speed and bumps the revision */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    private void setPosition(double newPosition, double newSpeed) {
        // when setting newPosition is the same as current and the speed is force-set, avoid overriding the forced value
        if (newPosition == this.position && !Double.isNaN(speed) && Double.isNaN(newSpeed))
            return;

        assert !Double.isInfinite(newPosition);
        assert Double.isNaN(newPosition) || comparePos(position, newPosition) <= 0;
        assert Double.isNaN(newSpeed) || Math.abs(newSpeed - part.interpolateSpeed(stepIndex, newPosition)) < 0.001;
        position = newPosition;
        speed = newSpeed;
        revision++;
    }

    /** Set the position and bumps the revision */
    private void setPosition(double newPosition) {
        setPosition(newPosition, Double.NaN);
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
            var nextPos = getStepBeginPos(nextPart, nextStartIndex);
            var nextSpeed = getStepBeginSpeed(nextPart, nextStartIndex);

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

    private static double getPartBound(EnvelopePart part, CmpOperator operation) {
        if (operation == CmpOperator.STRICTLY_HIGHER)
            return part.getMaxSpeed();
        return part.getMinSpeed();
    }

    /** Find the next point with a speed satisfying a given condition */
    public boolean findSpeed(double speed, CmpOperator operator) {
        if (hasReachedEnd())
            return false;

        // this predicate only matches envelope part which contain a speed which matches
        // the search requirement
        Predicate<EnvelopePart> partPredicate = (part) -> CmpOperator.compare(
                getPartBound(part, operator),
                operator, speed);

        // look for the next envelope part which contains a speed which matches the
        // search requirement. The current envelope part may contain such a point,
        // but it may be **before the cursor**.
        if (!findPart(partPredicate))
            return false;

        // scan until a step matching the requirement is found
        while (!CmpOperator.compare(getSpeed(), operator, speed)
                && !CmpOperator.compare(getStepEndSpeed(), operator, speed)) {
            var nextStepRes = nextStep();
            if (nextStepRes == NEXT_REACHED_END)
                return false;
            // if the current part was scanned and contains no matching step,
            // scan for another matching envelope part.
            // this should only ever happen once, if the findSpeed call starts in a part
            // which has a matching point, but after this point.
            if (nextStepRes == NEXT_PART) {
                if (!findPart(partPredicate))
                    return false;
            }
        }

        // if the start of the step satisfies the condition already, there's a discontinuity
        // return immediately, as the cursor is already at the start of the step.
        if (CmpOperator.compare(getSpeed(), operator, speed))
            return true;

        // otherwise, find the intersecting position inside the step
        var intersectionPos = EnvelopePhysics.intersectStepWithSpeed(
                getStepBeginPos(), getStepBeginSpeed(), getStepEndPos(), getStepEndSpeed(),
                speed
        );
        setPosition(intersectionPos, speed);
        return true;
    }
}
