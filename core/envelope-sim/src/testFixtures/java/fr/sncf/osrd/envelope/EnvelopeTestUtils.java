package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import org.junit.jupiter.api.Assertions;
import java.util.List;

public class EnvelopeTestUtils {
    public enum TestAttr implements EnvelopeAttr {
        A,
        B,
        C,
        ;

        @Override
        public Class<? extends EnvelopeAttr> getAttrType() {
            return TestAttr.class;
        }
    }

    static EnvelopePart buildContinuous(
            EnvelopeCursor cursor, Iterable<EnvelopeAttr> attrs,
            double[] positions, double[] speeds, boolean isBackward
    ) {
        var lastIndex = positions.length - 1;
        double direction = isBackward ? -1 : 1;
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttrs(attrs);
        if (!isBackward) {
            cursor.findPosition(positions[0]);

            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder, new SpeedConstraint(0, FLOOR), new EnvelopeConstraint(cursor.envelope, CEILING)
            );
            Assertions.assertTrue(overlayBuilder.initEnvelopePart(cursor.getPosition(), cursor.getSpeed(), direction));

            for (int i = 1; i < positions.length - 1; i++)
                Assertions.assertTrue(overlayBuilder.addStep(positions[i], speeds[i]));
            Assertions.assertFalse(overlayBuilder.addStep(positions[lastIndex], speeds[lastIndex]));
            cursor.findPosition(overlayBuilder.getLastPos());
        } else {
            cursor.findPosition(positions[lastIndex]);
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder, new SpeedConstraint(0, FLOOR), new EnvelopeConstraint(cursor.envelope, CEILING)
            );
            Assertions.assertTrue(overlayBuilder.initEnvelopePart(cursor.getPosition(), cursor.getSpeed(), direction));

            for (int i = lastIndex - 1; i > 0; i--)
                Assertions.assertTrue(overlayBuilder.addStep(positions[i], speeds[i]));
            Assertions.assertFalse(overlayBuilder.addStep(positions[0], speeds[0]));
            cursor.findPosition(overlayBuilder.getLastPos());
        }
        return partBuilder.build();
    }

    static void assertEquals(EnvelopePart expected, EnvelopePart actual) {
        assertEquals(expected, actual, 0.01);
    }

    static void assertEquals(EnvelopePart expected, EnvelopePart actual, double delta) {
        Assertions.assertEquals(expected.getAttrs(), actual.getAttrs());

        Assertions.assertArrayEquals(expected.clonePositions(), actual.clonePositions(), delta);
        Assertions.assertArrayEquals(expected.cloneSpeeds(), actual.cloneSpeeds(), delta);
        Assertions.assertArrayEquals(expected.cloneTimes(), actual.cloneTimes(), delta);
        Assertions.assertEquals(expected.getMaxSpeed(), actual.getMaxSpeed(), delta);
        Assertions.assertEquals(expected.getMinSpeed(), actual.getMinSpeed(), delta);
    }

    public static void assertEquals(Envelope expected, Envelope actual, double delta) {
        Assertions.assertEquals(expected.size(), actual.size());
        Assertions.assertEquals(expected.continuous, actual.continuous);
        Assertions.assertEquals(expected.getMaxSpeed(), actual.getMaxSpeed(), delta);
        Assertions.assertEquals(expected.getMinSpeed(), actual.getMinSpeed(), delta);
        for (int i = 0; i < expected.size(); i++)
            assertEquals(expected.get(i), actual.get(i), delta);
    }

    static void assertEquals(Envelope expected, Envelope actual) {
        assertEquals(expected, actual, 0.01);
    }

    public static EnvelopePart makeFlatPart(TestAttr attr, double beginPos, double endPos, double speed) {
        return makeFlatPart(List.of(attr), beginPos, endPos, speed);
    }

    public static EnvelopePart makeFlatPart(Iterable<EnvelopeAttr> attrs,
                                            double beginPos, double endPos, double speed) {
        return EnvelopePart.generateTimes(
                attrs,
                new double[]{beginPos, endPos},
                new double[]{speed, speed}
        );
    }
}
