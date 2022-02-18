package fr.sncf.osrd.envelope;

import org.junit.jupiter.api.Test;

public class EnvelopeBuilderTest {
    @Test
    public void testEnvelopeBuilder() {
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopePart.generateTimes(
                null,
                new double[]{0, 1},
                new double[]{10, 20}
        ));
        builder.addPart(EnvelopePart.generateTimes(
                null,
                new double[]{1, 2},
                new double[]{20, 30}
        ));
        var env = builder.build();
        assert env.continuous;
        assert env.spaceContinuous;
    }

    @Test
    public void testEnvelopeBuilderReversed() {
        var builder = new EnvelopeBuilder();
        builder.addPart(EnvelopePart.generateTimes(
                null,
                new double[]{1, 2},
                new double[]{20, 30}
        ));
        builder.addPart(EnvelopePart.generateTimes(
                null,
                new double[]{0, 1},
                new double[]{10, 20}
        ));
        builder.reverse();
        var env = builder.build();
        assert env.continuous;
        assert env.spaceContinuous;
    }
}
