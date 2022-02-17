package fr.sncf.osrd.envelope.constraint;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.envelope.*;
import org.junit.jupiter.api.Test;

public class ConstraintBuilderTest {
    private ConstrainedEnvelopePartBuilder wrap(EnvelopePartConsumer sink) {
        var envelopeCeiling = Envelope.make(EnvelopePart.generateTimes(
                null,
                new double[] {0, 3, 6},
                new double[] {0, 3, 0}
        ));
        return new ConstrainedEnvelopePartBuilder(
                sink,
                new SpeedFloor(0),
                new SpeedCeiling(2),
                new PositionRange(1, 5),
                new EnvelopeCeiling(envelopeCeiling)
        );
    }

    @Test
    void testCeilingConstraint() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(3.5, 3));
        assertEquals(1, builder.lastIntersection);
    }

    @Test
    void testEnvelopeConstraint() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(5.1, 2.1));
        assertEquals(3, builder.lastIntersection);
    }

    @Test
    void testPositionConstraint() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(5.1, 0.5));
        assertEquals(2, builder.lastIntersection);
    }

    @Test
    void testSpeedFloorConstraint() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(4, 0));
        assertEquals(0, builder.lastIntersection);
    }

    
}
