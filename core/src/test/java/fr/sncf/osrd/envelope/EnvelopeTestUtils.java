package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Assertions;

public class EnvelopeTestUtils {
    public static final class EnvelopeTestMeta extends EnvelopePartMeta {
    }

    static void buildContinuous(
            EnvelopeOverlayBuilder builder, EnvelopePartMeta meta, boolean physicallyAccurate,
            double[] positions, double[] speeds, boolean isBackward
    ) {
        var lastIndex = positions.length - 1;
        if (!isBackward) {
            builder.startContinuousOverlay(meta, physicallyAccurate, positions[0]);
            for (int i = 1; i < positions.length - 1; i++)
                assertFalse(builder.addStep(positions[i], speeds[i]));
            assertTrue(builder.addStep(positions[lastIndex], speeds[lastIndex]));
        } else {
            builder.startContinuousOverlay(meta, physicallyAccurate, positions[lastIndex]);
            for (int i = lastIndex - 1; i > 0; i--)
                assertFalse(builder.addStep(positions[i], speeds[i]));
            assertTrue(builder.addStep(positions[0], speeds[0]));
        }
    }

    static void assertEquals(EnvelopePart expected, EnvelopePart actual) {
        assertEquals(expected, actual, 0.01);
    }

    static void assertEquals(EnvelopePart expected, EnvelopePart actual, double delta) {
        Assertions.assertSame(expected.meta, actual.meta);
        Assertions.assertEquals(expected.physicallyAccurate, actual.physicallyAccurate);

        Assertions.assertArrayEquals(expected.positions, actual.positions, delta);
        Assertions.assertArrayEquals(expected.speeds, actual.speeds, delta);
        Assertions.assertArrayEquals(expected.times, actual.times, delta);
    }

    static void assertEquals(Envelope expected, Envelope actual) {
        Assertions.assertEquals(expected.size(), actual.size());
        Assertions.assertEquals(expected.physicallyAccurate, actual.physicallyAccurate);
        Assertions.assertEquals(expected.spaceContinuous, actual.spaceContinuous);
        for (int i = 0; i < expected.size(); i++)
            assertEquals(expected.get(i), actual.get(i));
    }
}
