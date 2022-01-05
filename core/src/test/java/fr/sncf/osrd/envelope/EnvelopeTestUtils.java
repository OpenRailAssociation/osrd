package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Assertions;

public class EnvelopeTestUtils {
    public static final class EnvelopeTestMeta extends EnvelopePartMeta {
    }

    static void buildContinuous(
            OverlayEnvelopeBuilder builder, EnvelopePartMeta meta,
            double[] positions, double[] speeds, boolean isBackward
    ) {
        var lastIndex = positions.length - 1;
        if (!isBackward) {
            builder.cursor.findPosition(positions[0]);

            var partBuilder = builder.startContinuousOverlay(meta);
            for (int i = 1; i < positions.length - 1; i++)
                assertFalse(partBuilder.addStep(positions[i], speeds[i]));
            assertTrue(partBuilder.addStep(positions[lastIndex], speeds[lastIndex]));
            builder.addPart(partBuilder);
        } else {
            builder.cursor.findPosition(positions[lastIndex]);
            var partBuilder = builder.startContinuousOverlay(meta);
            for (int i = lastIndex - 1; i > 0; i--)
                assertFalse(partBuilder.addStep(positions[i], speeds[i]));
            assertTrue(partBuilder.addStep(positions[0], speeds[0]));
            builder.addPart(partBuilder);
        }
    }

    static void assertEquals(EnvelopePart expected, EnvelopePart actual) {
        assertEquals(expected, actual, 0.01);
    }

    static void assertEquals(EnvelopePart expected, EnvelopePart actual, double delta) {
        Assertions.assertSame(expected.meta, actual.meta);

        Assertions.assertArrayEquals(expected.clonePositions(), actual.clonePositions(), delta);
        Assertions.assertArrayEquals(expected.cloneSpeeds(), actual.cloneSpeeds(), delta);
        Assertions.assertArrayEquals(expected.cloneTimes(), actual.cloneTimes(), delta);
    }

    static void assertEquals(Envelope expected, Envelope actual) {
        Assertions.assertEquals(expected.size(), actual.size());
        Assertions.assertEquals(expected.spaceContinuous, actual.spaceContinuous);
        Assertions.assertEquals(expected.continuous, actual.continuous);
        for (int i = 0; i < expected.size(); i++)
            assertEquals(expected.get(i), actual.get(i));
    }
}
