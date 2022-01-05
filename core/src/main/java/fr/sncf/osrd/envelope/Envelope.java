package fr.sncf.osrd.envelope;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class Envelope  {
    private final EnvelopePart[] parts;
    public final boolean spaceContinuous;
    public final boolean continuous;

    // region CONSTRUCTORS

    private Envelope(EnvelopePart[] parts, boolean spaceContinuous, boolean continuous) {
        assert parts.length != 0;
        this.parts = parts;
        this.spaceContinuous = spaceContinuous;
        this.continuous = continuous;
    }

    /** Create a new Envelope */
    public static Envelope make(EnvelopePart... parts) {
        boolean spaceContinuous = allPartTransitions(Envelope::areSpaceContinuous, parts);
        boolean continuous = spaceContinuous && allPartTransitions(Envelope::areSpeedContinuous, parts);
        return new Envelope(parts, spaceContinuous, continuous);
    }

    /** A predicate which applies to a transition between two points */
    public interface TransitionPredicate {
        boolean test(double prevPos, double prevSpeed, double nextPos, double nextSpeed);
    }

    /** Checks that all transitions between envelope part match a predicate */
    private static boolean allPartTransitions(TransitionPredicate predicate, EnvelopePart[] parts) {
        for (int i = 0; i < parts.length - 1; i++) {
            var prevPart = parts[i];
            var nextPart = parts[i + 1];
            var prevPos = prevPart.getEndPos();
            var prevSpeed = prevPart.getEndSpeed();
            var nextPos = nextPart.getBeginPos();
            var nextSpeed = nextPart.getBeginSpeed();
            if (!predicate.test(prevPos, prevSpeed, nextPos, nextSpeed))
                return false;
        }
        return true;
    }

    public static boolean areSpaceContinuous(double prevPos, double prevSpeed, double nextPos, double nextSpeed) {
        return prevPos == nextPos;
    }

    public static boolean areSpeedContinuous(double prevPos, double prevSpeed, double nextPos, double nextSpeed) {
        return prevSpeed == nextSpeed;
    }

    // endregion

    // region GETTERS

    public int size() {
        return parts.length;
    }

    public EnvelopePart get(int i) {
        return parts[i];
    }

    // endregion

    /** Cuts an envelope */
    public EnvelopePart[] slice(
            int beginPartIndex, int beginStepIndex, double beginPosition,
            int endPartIndex, int endStepIndex, double endPosition
    ) {
        assert beginPartIndex <= endPartIndex;

        if (beginPartIndex == endPartIndex) {
            var part = parts[beginPartIndex];
            var sliced = part.slice(beginStepIndex, beginPosition, endStepIndex, endPosition);
            if (sliced == null)
                return new EnvelopePart[] {};
            return new EnvelopePart[] { sliced };
        }

        var beginPart = parts[beginPartIndex];
        var endPart = parts[endPartIndex];
        var beginPartSliced = beginPart.sliceEnd(beginStepIndex, beginPosition);
        var endPartSliced = endPart.sliceBeginning(endStepIndex, endPosition);

        // compute the number of unchanged envelope parts between sliced parts
        var copySize = endPartIndex - beginPartIndex + 1 - /* sliced endpoints */ 2;

        // compute the total sliced envelope size
        var size = copySize;
        if (beginPartSliced != null)
            size++;
        if (endPartSliced != null)
            size++;

        var res = new EnvelopePart[size];

        int cur = 0;
        if (beginPartSliced != null)
            res[cur++] = beginPartSliced;

        var copyStartIndex = beginPartIndex + 1;
        for (int i = 0; i < copySize; i++)
            res[cur++] = parts[copyStartIndex + i];

        if (endPartSliced != null)
            res[cur] = endPartSliced;
        return res;
    }

    /** Cuts the envelope */
    public EnvelopePart[] smartSlice(
            int beginPartIndex, int beginStepIndex, double beginPosition,
            int endPartIndex, int endStepIndex, double endPosition
    ) {
        if (beginPartIndex == -1) {
            beginPartIndex = 0;
            var beginPart = parts[beginPartIndex];
            beginStepIndex = 0;
            beginPosition = beginPart.getBeginPos();
        }
        if (endPartIndex == -1) {
            endPartIndex = parts.length - 1;
            var endPart = parts[endPartIndex];
            endStepIndex = endPart.stepCount() - 1;
            endPosition = endPart.getEndPos();
        }
        return slice(beginPartIndex, beginStepIndex, beginPosition, endPartIndex, endStepIndex, endPosition);
    }

    // region OTHER

    /** Export envelope as csv.
     * NOTE: This function is used for debug purpose. */
    public void saveCSV(String path) {
        try {
            PrintWriter writer = new PrintWriter(path, StandardCharsets.UTF_8);
            writer.println("position,speed");
            for (var part : parts) {
                for (int i = 0; i < part.pointCount(); i++) {
                    writer.println(String.format(Locale.US, "%f,%f", part.getPointPos(i), part.getPointSpeed(i)));
                }
            }
            writer.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    // endregion
}