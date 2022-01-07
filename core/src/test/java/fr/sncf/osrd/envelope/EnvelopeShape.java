package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;

public enum EnvelopeShape {
    INCREASING,
    DECREASING,
    CONSTANT;

    /** Gets the shape of a given step */
    public static EnvelopeShape fromStep(EnvelopePart part, int stepIndex) {
        var beginSpeed = part.getBeginSpeed(stepIndex);
        var endSpeed = part.getEndSpeed(stepIndex);
        if (beginSpeed == endSpeed)
            return CONSTANT;
        else if (beginSpeed < endSpeed)
            return INCREASING;
        return DECREASING;
    }

    /** Gets the sequence of envelope shape changes inside an envelope part */
    public static EnvelopeShape[] getPhases(EnvelopePart part) {
        var phases = new ArrayList<EnvelopeShape>();
        EnvelopeShape prevShape = null;
        for (int i = 0; i < part.stepCount(); i++) {
            var stepShape = fromStep(part, i);
            if (stepShape == prevShape)
                continue;
            phases.add(stepShape);
            prevShape = stepShape;
        }
        return phases.toArray(new EnvelopeShape[0]);
    }

    /** Checks whether an envelope parts matches a given sequence of shape changes */
    public static void check(EnvelopePart part, EnvelopeShape... expectedPhases) {
        var partPhases = getPhases(part);
        assertEquals(expectedPhases.length, partPhases.length);
        for (int i = 0; i < expectedPhases.length; i++) {
            var expectedPhase = expectedPhases[i];
            if (expectedPhase == null)
                continue;
            assertEquals(expectedPhase, partPhases[i]);
        }
    }

    /** Checks whether an envelope part consistently has the same shape */
    public static void check(EnvelopePart part, EnvelopeShape expectedPhase) {
        var partPhases = getPhases(part);
        assertEquals(1, partPhases.length);
        assertEquals(expectedPhase, partPhases[0]);
    }

    /** Checks whether an envelope follows a given shape, where envelope parts can have internal shape changes */
    public static void check(Envelope envelope, EnvelopeShape[][] expectedPhases) {
        assertEquals(envelope.size(), expectedPhases.length);
        for (int i = 0; i < expectedPhases.length; i++)
            check(envelope.get(i), expectedPhases[i]);
    }

    /** Checks whether an envelope follows a given shape, where envelope parts cannot have internal shape changes */
    public static void check(Envelope envelope, EnvelopeShape... expectedPhases) {
        assertEquals(expectedPhases.length, envelope.size());
        for (int i = 0; i < expectedPhases.length; i++)
            check(envelope.get(i), expectedPhases[i]);
    }
}
