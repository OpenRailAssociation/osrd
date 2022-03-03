package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePartConsumer;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeCeiling;
import fr.sncf.osrd.envelope.part.constraints.PositionRange;
import fr.sncf.osrd.envelope.part.constraints.SpeedCeiling;
import fr.sncf.osrd.envelope.part.constraints.SpeedFloor;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class ConstraintBuilderTest {
    private ConstrainedEnvelopePartBuilder wrap(EnvelopePartConsumer sink) {
        var envelopeCeiling = Envelope.make(EnvelopePart.generateTimes(
                List.of(),
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
    void testAttrs() {
        var partBuilder = new EnvelopePartBuilder();
        var builder = wrap(partBuilder);
        builder.setAttrs(List.of(TestAttr.A));
        builder.setAttr(TestAttr.B);
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertFalse(builder.addStep(3.5, 3));
        var part = partBuilder.build();
        assertEquals(TestAttr.B, part.getAttr(TestAttr.class));
    }

    @Test
    void testCeilingConstraint() {
        var partBuilder = new EnvelopePartBuilder();
        var builder = wrap(partBuilder);
        builder.setAttrs(List.of(TestAttr.A));
        builder.setAttr(TestAttr.B);
        assertTrue(builder.initEnvelopePart(2, 0, 1));
        assertTrue(builder.addStep(3, 1));
        assertFalse(builder.addStep(3.5, 3));
        assertEquals(1, builder.lastIntersection);
        var part = partBuilder.build();
        assertEquals(TestAttr.B, part.getAttr(TestAttr.class));
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
