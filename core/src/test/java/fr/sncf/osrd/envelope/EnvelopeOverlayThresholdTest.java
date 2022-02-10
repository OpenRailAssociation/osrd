package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.utils.CmpOperator;
import org.junit.jupiter.api.Test;

public class EnvelopeOverlayThresholdTest {
    @Test
    public void testSingleStepCrossLowerThreshold() {
        // 2 +====+====+===+ <= base
        //         \
        // 1 -------+------- <- threshold
        //           x
        // 0      3 4 5    8
        var constSpeedEnvelope = Envelope.make(EnvelopePart.generateTimes(
                null,
                new double[]{0, 8},
                new double[]{2, 2}
        ));
        var cursor = EnvelopeCursor.forward(constSpeedEnvelope);
        var builder = new OverlayEnvelopeBuilder(cursor);

        cursor.findPosition(3);
        {
            var partBuilder = builder.startContinuousOverlay(null, 1, CmpOperator.LOWER);
            assertTrue(partBuilder.addStep(4, 0));
            builder.addPart(partBuilder);
        }
        var envelope = builder.build();
        assertEquals(1.0, envelope.getMinSpeed());
        EnvelopeShape.check(envelope, CONSTANT, DECREASING, CONSTANT);
        EnvelopeTransitions.checkContinuity(envelope, true, false);
    }

    @Test
    public void testSingleStepOnLowerThreshold() {
        // 2 +====+====+===+ <= base
        //         \
        // 1 -------+------- <- threshold
        //
        // 0      3 4 5    8
        var constSpeedEnvelope = Envelope.make(EnvelopePart.generateTimes(
                null,
                new double[]{0, 8},
                new double[]{2, 2}
        ));
        var cursor = EnvelopeCursor.forward(constSpeedEnvelope);
        var builder = new OverlayEnvelopeBuilder(cursor);

        cursor.findPosition(3);
        {
            var partBuilder = builder.startContinuousOverlay(null, 1, CmpOperator.LOWER);
            assertTrue(partBuilder.addStep(4, 1));
            builder.addPart(partBuilder);
        }
        var envelope = builder.build();
        assertEquals(1.0, envelope.getMinSpeed());
        EnvelopeShape.check(envelope, CONSTANT, DECREASING, CONSTANT);
        EnvelopeTransitions.checkContinuity(envelope, true, false);
    }

    @Test
    public void testSingleStepCrossHigherThreshold() {
        // 2 +====+====+===+ <= base
        //           x
        // 1 -------+------- <- threshold
        //         /
        // 0      3 4 5    8
        var constSpeedEnvelope = Envelope.make(EnvelopePart.generateTimes(
                null,
                new double[]{0, 8},
                new double[]{2, 2}
        ));
        var cursor = EnvelopeCursor.forward(constSpeedEnvelope);
        var builder = new OverlayEnvelopeBuilder(cursor);

        cursor.findPosition(3);
        {
            var partBuilder = builder.startDiscontinuousOverlay(null, 0, 1, CmpOperator.HIGHER);
            assertTrue(partBuilder.addStep(4, 2));
            builder.addPart(partBuilder);
        }
        var envelope = builder.build();
        EnvelopeShape.check(envelope, CONSTANT, INCREASING, CONSTANT);
        EnvelopeTransitions.checkContinuity(envelope, false, false);
    }

    @Test
    public void testSingleStepOnHigherThreshold() {
        // 2 +====+====+===+ <= base
        //
        // 1 -------+------- <- threshold
        //         /
        // 0      3 4 5    8
        var constSpeedEnvelope = Envelope.make(EnvelopePart.generateTimes(
                null,
                new double[]{0, 8},
                new double[]{2, 2}
        ));
        var cursor = EnvelopeCursor.forward(constSpeedEnvelope);
        var builder = new OverlayEnvelopeBuilder(cursor);

        cursor.findPosition(3);
        {
            var partBuilder = builder.startDiscontinuousOverlay(null, 0, 1, CmpOperator.HIGHER);
            assertTrue(partBuilder.addStep(4, 1));
            builder.addPart(partBuilder);
        }
        var envelope = builder.build();
        EnvelopeShape.check(envelope, CONSTANT, INCREASING, CONSTANT);
        EnvelopeTransitions.checkContinuity(envelope, false, false);
    }

    @Test
    public void testMultipleStepsLowerThreshold() {
        // 20 +====+====+===+ <= base
        //          \
        // 10 -------+------- <- threshold
        //
        var constSpeedEnvelope = Envelope.make(EnvelopePart.generateTimes(
                null,
                new double[]{0, 80},
                new double[]{20, 20}
        ));
        var cursor = EnvelopeCursor.forward(constSpeedEnvelope);
        var builder = new OverlayEnvelopeBuilder(cursor);

        var position = 10.0;
        cursor.findPosition(position);
        var speed = cursor.getSpeed();
        {
            var partBuilder = builder.startContinuousOverlay(null, 10, CmpOperator.LOWER);
            do {
                position++;
                speed--;
            } while (!partBuilder.addStep(position, speed));
            builder.addPart(partBuilder);
        }
        var envelope = builder.build();
        assertEquals(10.0, envelope.getMinSpeed());
        EnvelopeShape.check(envelope, CONSTANT, DECREASING, CONSTANT);
        EnvelopeTransitions.checkContinuity(envelope, true, false);
    }
}
