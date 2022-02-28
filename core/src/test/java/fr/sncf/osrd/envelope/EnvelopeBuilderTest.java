package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

public class EnvelopeBuilderTest {
    @Test
    public void testEnvelopeBuilder() {
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopePart.generateTimes(
                new double[]{0, 1},
                new double[]{10, 20}
        ));
        builder.addPart(EnvelopePart.generateTimes(
                new double[]{1, 2},
                new double[]{20, 30}
        ));
        var env = builder.build();
        assertTrue(env.continuous);
    }

    @Test
    public void testEnvelopeBuilderReversed() {
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopePart.generateTimes(
                new double[]{1, 2},
                new double[]{20, 30}
        ));
        builder.addPart(EnvelopePart.generateTimes(
                new double[]{0, 1},
                new double[]{10, 20}
        ));
        builder.reverse();
        var env = builder.build();
        assertTrue(env.continuous);
    }
}
