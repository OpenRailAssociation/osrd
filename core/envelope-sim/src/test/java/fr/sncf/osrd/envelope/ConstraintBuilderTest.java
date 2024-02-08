package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.*;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePartConsumer;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import java.util.List;
import org.junit.jupiter.api.Test;

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
        var envelopeFloor = Envelope.make(EnvelopeTestUtils.generateTimes(
                new double[] {0, 3, 4, 5, 6, 7, 10}, new double[] {0, 0, 1, 2, 1, 0, 0}));
        var envelopeCeiling = Envelope.make(EnvelopeTestUtils.generateTimes(
                new double[] {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, new double[] {2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2}));
        return new ConstrainedEnvelopePartBuilder(
                sink,
                new SpeedConstraint(0, FLOOR),
                new SpeedConstraint(5, CEILING),
                new EnvelopeConstraint(envelopeFloor, FLOOR),
                new EnvelopeConstraint(envelopeCeiling, CEILING),
                new PositionConstraint(1, 9));
    }

    @Test
    void testAttrs() {
        var partBuilder = new EnvelopePartBuilder();
        var builder = wrap(partBuilder);
        builder.setAttrs(List.of(TestAttr.A));
        builder.setAttr(TestAttr.B);
        builder.setAttr(EnvelopeProfile.ACCELERATING);
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
    void testSpeedMaintainConstraint() {
        var partBuilder = new EnvelopePartBuilder();
        var constraint = new SpeedConstraint(2, EQUAL);
        var builder = new ConstrainedEnvelopePartBuilder(partBuilder, constraint);
        assertTrue(builder.initEnvelopePart(2, 2, 1));
        assertTrue(builder.addStep(2.5, 2));
        assertFalse(builder.addStep(3, 1));
        builder.lastIntersection = -1;
        assertFalse(builder.addStep(3, 3));
        assertEquals(0, builder.lastIntersection);
    }

    @Test
    void testNoConstraint() {
        var partBuilder = new EnvelopePartBuilder();
        var builder = new ConstrainedEnvelopePartBuilder(partBuilder);
        assertTrue(builder.initEnvelopePart(2, 2, 1));
        assertTrue(builder.addStep(2.5, 2));
    }

    @Test
    void testEnvelopeFloor() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(5, 1));
        assertEquals(2, builder.lastIntersection);
        builder.lastIntersection = -1;
        assertFalse(builder.initEnvelopePart(-1, 0, 1));
        assertFalse(builder.initEnvelopePart(11, 0, 1));
    }

    @Test
    void testEnvelopeCeiling() {
        var builder = wrap(new NullEnvelopePartConsumer());
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(8, 5));
        assertEquals(3, builder.lastIntersection);
        assertFalse(builder.initEnvelopePart(-1, 0, 1));
        assertFalse(builder.initEnvelopePart(11, 0, 1));
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
