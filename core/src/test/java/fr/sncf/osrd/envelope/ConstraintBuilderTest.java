package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;
import static org.junit.jupiter.api.Assertions.*;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import fr.sncf.osrd.envelope.part.*;
import fr.sncf.osrd.envelope.part.constraints.*;
import org.junit.jupiter.api.Test;
import java.util.List;

public class ConstraintBuilderTest {

    // 7    |           x           | <--------- Position Constraints
    // 6             x     x        |
    // 5 ...|.. ..x...........x.. ..|..... <---- Speed Ceiling
    // 4    |  x                 x  |
    // 3    x                       x <--------- Envelope Ceiling
    // 2 x  |           o           |  x
    // 1    |        o     o <------------------ Envelope Floor
    // 0 o__|_____o___________o_____|__o__ <---- Speed Floor
    //   0  1  2  3  4  5  6  7  8  9  10

    private ConstrainedEnvelopePartBuilder wrap(EnvelopePartConsumer sink) {
        var envelopeFloor = Envelope.make(EnvelopePart.generateTimes(
                List.of(),
                new double[] {0, 3, 4, 5, 6, 7, 10},
                new double[] {0, 0, 1, 2, 1, 0, 0}
        ));
        var envelopeCeiling = Envelope.make(EnvelopePart.generateTimes(
                List.of(),
                new double[] {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
                new double[] {2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2}
        ));
        return new ConstrainedEnvelopePartBuilder(
                sink,
                new SpeedConstraint(0, FLOOR),
                new SpeedConstraint(5, CEILING),
                new EnvelopeConstraint(envelopeFloor, FLOOR),
                new EnvelopeConstraint(envelopeCeiling, CEILING),
                new PositionConstraint(1, 9)
        );
    }

    @Test
    void testAttrs() {
        var partBuilder = new EnvelopePartBuilder();
        var builder = wrap(partBuilder);
        builder.setAttrs(List.of(TestAttr.A));
        builder.setAttr(TestAttr.B);
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertFalse(builder.addStep(5, 1));
        var part = partBuilder.build();
        assertEquals(TestAttr.B, part.getAttr(TestAttr.class));
    }

    @Test
    void testSpeedFloorConstraint() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(2.5, 1));
        assertFalse(builder.addStep(3, 0));
        assertEquals(0, builder.lastIntersection);
    }

    @Test
    void testSpeedCeilingConstraint() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(5, 3));
        assertFalse(builder.addStep(5.5, 6));
        assertEquals(1, builder.lastIntersection);
    }

    @Test
    void testEnvelopeFloor() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(5, 1));
        assertEquals(2, builder.lastIntersection);
    }

    @Test
    void testEnvelopeCeiling() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(8, 5));
        assertEquals(3, builder.lastIntersection);
    }

    @Test
    void testPositionConstraint() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(5, 4));
        assertFalse(builder.addStep(9.1, 0.5));
        assertEquals(4, builder.lastIntersection);
    }
}
