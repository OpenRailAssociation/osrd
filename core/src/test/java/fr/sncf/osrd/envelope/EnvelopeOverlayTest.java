package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.EnvelopeTestMeta;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

public class EnvelopeOverlayTest {
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void noChangeSinglePartOverlay(boolean backwardDir) {
        //  +==============+
        //  0              8
        var baseEnvelope = Envelope.make(EnvelopePart.generateTimes(
                null,
                new double[]{0, 8},
                new double[]{1, 1}
        ));

        var builder = EnvelopeOverlayBuilder.withDirection(baseEnvelope, backwardDir);
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
                        null,
                        new double[]{0, 8},
                        new double[]{1, 1}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{8, 16},
                        new double[]{2, 2}
                )
        );

        var builder = EnvelopeOverlayBuilder.withDirection(baseEnvelope, backwardDir);
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
                null,
                new double[]{0, 8},
                new double[]{2, 2}
        );
        var constSpeedEnvelope = Envelope.make(constSpeedPart);
        var builder = EnvelopeOverlayBuilder.forward(constSpeedEnvelope);
        builder.startContinuousOverlay(null, 3);
        assertFalse(builder.addStep(4, 1));
        assertTrue(builder.addStep(5, 4));
        var envelope = builder.build();
        assertEquals(3, envelope.size());
        assertTrue(envelope.continuous);

        var expectedFirst = constSpeedPart.sliceBeginning(constSpeedPart.findStep(3), 3);
        EnvelopeTestUtils.assertEquals(expectedFirst, envelope.get(0));
    }

    @Test
    void testMultipleOverlays() {
        var constSpeedPart = EnvelopePart.generateTimes(
                null,
                new double[]{0, 8},
                new double[]{2, 2}
        );
        var constSpeedEnvelope = Envelope.make(constSpeedPart);
        var builder = EnvelopeOverlayBuilder.forward(constSpeedEnvelope);
        builder.startContinuousOverlay(null, 0);
        assertFalse(builder.addStep(1, 1));
        assertTrue(builder.addStep(3, 2));

        builder.startContinuousOverlay(null, 6);
        assertFalse(builder.addStep(7, 1));
        assertTrue(builder.addStep(8, 2));

        var envelope = builder.build();
        assertEquals(3, envelope.size());
        assertTrue(envelope.continuous);

        EnvelopeTestUtils.assertEquals(constSpeedPart.slice(0, 3, 0, 6), envelope.get(1));
    }

    @Test
    void testMultipleBackwardOverlays() {
        var constSpeedPart = EnvelopePart.generateTimes(
                null,
                new double[]{0, 8},
                new double[]{2, 2}
        );
        var constSpeedEnvelope = Envelope.make(constSpeedPart);
        var builder = EnvelopeOverlayBuilder.forward(constSpeedEnvelope);
        builder.startContinuousOverlay(null, 0);
        assertFalse(builder.addStep(1, 1));
        assertTrue(builder.addStep(3, 2));

        builder.startContinuousOverlay(null, 6);
        assertFalse(builder.addStep(7, 1));
        assertTrue(builder.addStep(8, 2));

        var envelope = builder.build();
        assertEquals(3, envelope.size());
        assertTrue(envelope.continuous);

        EnvelopeTestUtils.assertEquals(constSpeedPart.slice(0, 3, 0, 6), envelope.get(1));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void testSymmetricOverlay(boolean backwardDir) {
        var testMeta = new EnvelopeTestMeta();
        var constSpeedPart = EnvelopePart.generateTimes(
                null,
                new double[]{0, 3.5, 8},
                new double[]{2, 2, 2}
        );
        double[] overlayPoints = backwardDir ? new double[] {5, 4, 3} : new double[] { 3, 4, 5};
        var constSpeedEnvelope = Envelope.make(constSpeedPart);
        var builder = EnvelopeOverlayBuilder.withDirection(constSpeedEnvelope, backwardDir);
        builder.startContinuousOverlay(testMeta, overlayPoints[0]);
        assertFalse(builder.addStep(overlayPoints[1], 1));
        assertTrue(builder.addStep(overlayPoints[2], 2));
        var envelope = builder.build();
        assertEquals(3, envelope.size());
        assertTrue(envelope.continuous);

        var expectedFirst = constSpeedPart.sliceBeginning(constSpeedPart.findStep(3), 3);
        EnvelopeTestUtils.assertEquals(expectedFirst, envelope.get(0));
        var expectedMid = EnvelopePart.generateTimes(
                testMeta,
                new double[]{3, 4, 5},
                new double[]{2, 1, 2}
        );
        EnvelopeTestUtils.assertEquals(expectedMid, envelope.get(1));
        var expectedLast = constSpeedPart.sliceEnd(constSpeedPart.findStep(5), 5);
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
                        null,
                        new double[]{0, 1},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{1, 4},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{4, 6},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{6, 8},
                        new double[]{4, 4}
                )
        );

        var builder = EnvelopeOverlayBuilder.withDirection(baseEnvelope, isBackward);
        var positions = new double[] { 3, 4, 6 };
        var speeds = new double[] { 4, 3, 4 };
        EnvelopeTestUtils.buildContinuous(builder, null, positions, speeds, isBackward);
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
                        null,
                        new double[]{0, 2},
                        new double[]{6, 6}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{2, 4},
                        new double[]{6, 6}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{4, 5},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{5, 6},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{6, 8},
                        new double[]{6, 6}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{8, 10},
                        new double[]{6, 6}
                )
        );

        var builder = EnvelopeOverlayBuilder.forward(baseEnvelope);
        builder.startContinuousOverlay(null, 1);
        assertTrue(builder.addStep(5, 5));
        var forwardEnvelope = builder.build();
        assertEquals(6, forwardEnvelope.size());
        assertTrue(forwardEnvelope.spaceContinuous);
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
                        null,
                        new double[]{0, 1},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{1, 4},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{4, 6},
                        new double[]{4, 4}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[]{6, 8},
                        new double[]{4, 4}
                )
        );

        var builder = EnvelopeOverlayBuilder.withDirection(baseEnvelope, reverse);
        var positions = new double[] { 3, 4, 5, 6 };
        var speeds = new double[] { 4, 3, 3, 4 };
        EnvelopeTestUtils.buildContinuous(builder, null, positions, speeds, reverse);
        var envelope = builder.build();
        assertEquals(4, envelope.size());
        assertTrue(envelope.continuous);
    }

    @Test
    void testUnlikelyIntersection() {
        var constSpeedEnvelope = Envelope.make(EnvelopePart.generateTimes(
                null,
                new double[]{0, 3, 4},
                new double[]{2, 1, 0}
        ));

        var builder = EnvelopeOverlayBuilder.forward(constSpeedEnvelope);
        builder.startContinuousOverlay(null, 0);
        assertFalse(builder.addStep(1, 1));
        assertTrue(builder.addStep(4, 1));
        var envelope = builder.build();
        assertEquals(2, envelope.size());
        assertTrue(envelope.continuous);
    }
}
