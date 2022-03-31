package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.*;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import org.checkerframework.checker.units.qual.C;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.List;

public class EnvelopeOverlayTest {
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void noChangeSinglePartOverlay(boolean backwardDir) {
        //  +==============+
        //  0              8
        var baseEnvelope = Envelope.make(EnvelopePart.generateTimes(
                new double[]{0, 8},
                new double[]{1, 1}
        ));

        var builder = OverlayEnvelopeBuilder.withDirection(baseEnvelope, backwardDir);
        var newEnvelope = builder.build();

        EnvelopeTestUtils.assertEquals(baseEnvelope, newEnvelope);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void noChangeTwoPartOverlay(boolean backwardDir) {
        //  +==============+==============+
        //  0              8              16
        var baseEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        new double[]{0, 8},
                        new double[]{1, 1}
                ),
                EnvelopePart.generateTimes(
                        new double[]{8, 16},
                        new double[]{2, 2}
                )
        );

        var builder = OverlayEnvelopeBuilder.withDirection(baseEnvelope, backwardDir);
        var newEnvelope = builder.build();

        EnvelopeTestUtils.assertEquals(baseEnvelope, newEnvelope);
    }

    @Test
    void testConstantSpeedOverlay() {
        //  +====+=====+====+ <= base
        //        \   /  <= overlay
        //          +
        //  0    3  4  5    8
        var constSpeedPart = EnvelopePart.generateTimes(
                new double[]{0, 8},
                new double[]{2, 2}
        );
        var constSpeedEnvelope = Envelope.make(constSpeedPart);
        var builder = OverlayEnvelopeBuilder.forward(constSpeedEnvelope);
        {
            var partBuilder = new EnvelopePartBuilder();
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder, new EnvelopeConstraint(constSpeedEnvelope, CEILING));
            overlayBuilder.initEnvelopePart(3, constSpeedEnvelope.interpolateSpeed(3), 1);
            assertTrue(overlayBuilder.addStep(4, 1));
            assertFalse(overlayBuilder.addStep(5, 4));
            builder.addPart(partBuilder.build());
        }
        var envelope = builder.build();
        assertEquals(3, envelope.size());
        assertEquals(1, envelope.get(1).getMinSpeed());
        assertEquals(2, envelope.get(1).getMaxSpeed());
        assertTrue(envelope.continuous);

        var expectedFirst = constSpeedPart.sliceBeginning(constSpeedPart.findLeft(3), 3, Double.NaN);
        EnvelopeTestUtils.assertEquals(expectedFirst, envelope.get(0));
    }

    @Test
    void testMultipleOverlays() {
        var constSpeedPart = EnvelopePart.generateTimes(
                new double[]{0, 8},
                new double[]{2, 2}
        );
        var constSpeedEnvelope = Envelope.make(constSpeedPart);
        var builder = OverlayEnvelopeBuilder.forward(constSpeedEnvelope);

        {
            var partBuilder = new EnvelopePartBuilder();
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder, new EnvelopeConstraint(constSpeedEnvelope, CEILING));
            overlayBuilder.initEnvelopePart(0, constSpeedEnvelope.interpolateSpeed(0), 1);
            assertTrue(overlayBuilder.addStep(1, 1));
            assertFalse(overlayBuilder.addStep(3, 2));
            builder.addPart(partBuilder.build());
        }

        {
            var partBuilder = new EnvelopePartBuilder();
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder, new EnvelopeConstraint(constSpeedEnvelope, CEILING));
            overlayBuilder.initEnvelopePart(6, constSpeedEnvelope.interpolateSpeed(6), 1);
            assertTrue(overlayBuilder.addStep(7, 1));
            assertFalse(overlayBuilder.addStep(8, 2));
            builder.addPart(partBuilder.build());
        }

        var envelope = builder.build();
        assertEquals(3, envelope.size());
        assertTrue(envelope.continuous);

        EnvelopeTestUtils.assertEquals(constSpeedPart.slice(0, 3, 0, 6), envelope.get(1));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void testSymmetricOverlay(boolean backwardDir) {
        var constSpeedPart = EnvelopePart.generateTimes(
                List.of(TestAttr.B),
                new double[]{0, 3.5, 8},
                new double[]{2, 2, 2}
        );
        double[] overlayPoints = backwardDir ? new double[] {5, 4, 3} : new double[] { 3, 4, 5};
        var constSpeedEnvelope = Envelope.make(constSpeedPart);
        var builder = OverlayEnvelopeBuilder.withDirection(constSpeedEnvelope, backwardDir);

        {
            var partBuilder = new EnvelopePartBuilder();
            partBuilder.setAttr(TestAttr.A);
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder, new EnvelopeConstraint(constSpeedEnvelope, CEILING));
            overlayBuilder.initEnvelopePart(overlayPoints[0], 2, backwardDir ? -1 : 1);
            assertTrue(overlayBuilder.addStep(overlayPoints[1], 1));
            assertFalse(overlayBuilder.addStep(overlayPoints[2], 2));
            builder.addPart(partBuilder.build());
        }

        var envelope = builder.build();
        assertEquals(3, envelope.size());
        assertTrue(envelope.continuous);

        var expectedFirst = constSpeedPart.sliceBeginning(constSpeedPart.findLeft(3), 3, Double.NaN);
        EnvelopeTestUtils.assertEquals(expectedFirst, envelope.get(0));
        var expectedMid = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[]{3, 4, 5},
                new double[]{2, 1, 2}
        );
        EnvelopeTestUtils.assertEquals(expectedMid, envelope.get(1));
        var expectedLast = constSpeedPart.sliceEnd(constSpeedPart.findRight(5), 5, Double.NaN);
        EnvelopeTestUtils.assertEquals(expectedLast, envelope.get(2));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void testBaseCurveSplit(boolean isBackward) {
        // 4 +===+=======+=======+===+ <= base
        //            \        /
        //             \     / <== overlay
        //              \  /
        //               +
        //    0  1   3   4   5   6   8
        var baseEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        new double[]{0, 1},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        new double[]{1, 4},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        new double[]{4, 6},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        new double[]{6, 8},
                        new double[]{4, 4}
                )
        );

        var builder = OverlayEnvelopeBuilder.withDirection(baseEnvelope, isBackward);
        var cursor = new EnvelopeCursor(baseEnvelope, isBackward);
        var positions = new double[] { 3, 4, 6 };
        var speeds = new double[] { 4, 3, 4 };
        builder.addPart(EnvelopeTestUtils.buildContinuous(cursor, List.of(), positions, speeds, isBackward));
        var envelope = builder.build();
        assertEquals(4, envelope.size());
        assertTrue(envelope.continuous);
    }

    @Test
    void testDiscontinuityOverlayEnd() {
        // 6 ======+===+       +===+==== <= base
        //      -------- <= overlay
        // 4           +===+===+ <= base
        //   0  1  2   4   5   6   8   10
        var baseEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        new double[]{0, 2},
                        new double[]{6, 6}
                ),
                EnvelopePart.generateTimes(
                        new double[]{2, 4},
                        new double[]{6, 6}
                ),
                EnvelopePart.generateTimes(
                        new double[]{4, 5},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        new double[]{5, 6},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        new double[]{6, 8},
                        new double[]{6, 6}
                ),
                EnvelopePart.generateTimes(
                        new double[]{8, 10},
                        new double[]{6, 6}
                )
        );

        var builder = OverlayEnvelopeBuilder.forward(baseEnvelope);

        {
            var partBuilder = new EnvelopePartBuilder();
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    new EnvelopeConstraint(baseEnvelope, CEILING)
            );
            overlayBuilder.initEnvelopePart(1, baseEnvelope.interpolateSpeedLeftDir(1, 1), 1);
            assertFalse(overlayBuilder.addStep(5, 5));
            builder.addPart(partBuilder.build());
        }

        var forwardEnvelope = builder.build();
        assertEquals(6, forwardEnvelope.size());
        assertFalse(forwardEnvelope.continuous);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void testLongOverlay(boolean reverse) {
        // 4 +===+=======+=======+===+ <== base
        //            \         /
        //             \       / <== overlay
        //              \     /
        //               +---+
        //    0  1   3   4   5   6   8
        var baseEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        new double[]{0, 1},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        new double[]{1, 4},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        new double[]{4, 6},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        new double[]{6, 8},
                        new double[]{4, 4}
                )
        );

        var builder = OverlayEnvelopeBuilder.withDirection(baseEnvelope, reverse);
        var cursor = new EnvelopeCursor(baseEnvelope, reverse);
        var positions = new double[] { 3, 4, 5, 6 };
        var speeds = new double[] { 4, 3, 3, 4 };
        builder.addPart(EnvelopeTestUtils.buildContinuous(cursor, List.of(), positions, speeds, reverse));
        var envelope = builder.build();
        assertEquals(4, envelope.size());
        assertTrue(envelope.continuous);
    }

    @Test
    void testUnlikelyIntersection() {
        var inputEnvelope = Envelope.make(EnvelopePart.generateTimes(
                new double[]{0, 3, 4},
                new double[]{2, 1, 0}
        ));

        var builder = OverlayEnvelopeBuilder.forward(inputEnvelope);

        {
            var partBuilder = new EnvelopePartBuilder();
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    new EnvelopeConstraint(inputEnvelope, CEILING)
            );
            overlayBuilder.initEnvelopePart(0, inputEnvelope.interpolateSpeed(1), 1);
            assertTrue(overlayBuilder.addStep(1, 1));
            assertFalse(overlayBuilder.addStep(4, 1));
            builder.addPart(partBuilder.build());
        }

        var envelope = builder.build();
        assertEquals(2, envelope.size());
        assertTrue(envelope.continuous);
    }

    @Test
    void testIncreasingContinuousOverlay() {
        var inputEnvelope = Envelope.make(EnvelopePart.generateTimes(
                new double[]{0, 2, 4},
                new double[]{1, 1, 3}
        ));

        var builder = OverlayEnvelopeBuilder.forward(inputEnvelope);

        {
            var partBuilder = new EnvelopePartBuilder();
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    new EnvelopeConstraint(inputEnvelope, CEILING)
            );
            overlayBuilder.initEnvelopePart(2, inputEnvelope.interpolateSpeed(2), 1);
            assertTrue(overlayBuilder.addStep(3, 2));
            assertFalse(overlayBuilder.addStep(4, 3));
            builder.addPart(partBuilder.build());
        }

        var envelope = builder.build();
        assertEquals(2, envelope.size());
        assertTrue(envelope.continuous);
    }
}
