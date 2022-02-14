package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertEquals;


public class EnvelopeTransitions {
    /** Validates the position and space continuity of envelope part transitions */
    public static void checkPositions(Envelope envelope, double delta, double... expectedTransitions) {
        assert expectedTransitions.length == envelope.size() - 1 : "Expected number of transitions does not match";
        for (int i = 0; i < envelope.size() - 1; i++) {
            var curPart = envelope.get(i);
            var nextPart = envelope.get(i + 1);
            assertEquals(curPart.getEndPos(), nextPart.getBeginPos());
            assertEquals(expectedTransitions[i], curPart.getEndPos(), delta);
        }
    }

    /** Validates the speed continuity of envelope part transitions */
    public static void checkContinuity(Envelope envelope, boolean... expectedContinuity) {
        for (int i = 0; i < envelope.size() - 1; i++) {
            var curPart = envelope.get(i);
            var nextPart = envelope.get(i + 1);
            var isContinuous = curPart.getEndSpeed() == nextPart.getBeginSpeed();
            assertEquals(expectedContinuity[i], isContinuous);
        }
    }
}
