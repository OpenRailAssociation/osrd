package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

public class EnvelopeBuilderTest {
    @Test
    public void testEnvelopeBuilder() {
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopeTestUtils.generateTimes(new double[] {0, 1}, new double[] {10, 20}));
        builder.addPart(EnvelopeTestUtils.generateTimes(new double[] {1, 2}, new double[] {20, 30}));
        var env = builder.build();
        assertTrue(env.continuous);
    }

    @Test
    public void testEnvelopeBuilderEpsilonSpeedContinuity() {
        // One example is that allowance can generate rounding errors
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopeTestUtils.generateTimes(new double[] {0, 1}, new double[] {10, 20}));
        builder.addPart(EnvelopeTestUtils.generateTimes(new double[] {1, 2}, new double[] {20.0000001, 30}));
        var env = builder.build();
        assertTrue(env.continuous);
    }

    @Test
    public void testEnvelopeBuilderEpsilonSpeedDiscontinuity() {
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopeTestUtils.generateTimes(new double[] {0, 1}, new double[] {10, 20}));
        builder.addPart(EnvelopeTestUtils.generateTimes(new double[] {1, 2}, new double[] {20.001, 30}));
        var env = builder.build();
        assertFalse(env.continuous);
    }

    @Test
    public void testEnvelopeBuilderReversed() {
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopeTestUtils.generateTimes(new double[] {1, 2}, new double[] {20, 30}));
        builder.addPart(EnvelopeTestUtils.generateTimes(new double[] {0, 1}, new double[] {10, 20}));
        builder.reverse();
        var env = builder.build();
        assertTrue(env.continuous);
    }
}
