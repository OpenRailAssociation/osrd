package fr.sncf.osrd.envelope

import fr.sncf.osrd.envelope.Envelope.Companion.make
import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart.Companion.generateTimes
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class EnvelopeOverlayTest {
    @ParameterizedTest
    @ValueSource(booleans = [false, true])
    fun noChangeSinglePartOverlay(backwardDir: Boolean) {
        //  +==============+
        //  0              8
        val baseEnvelope =
            make(EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 8.0), doubleArrayOf(1.0, 1.0)))

        val builder = OverlayEnvelopeBuilder.withDirection(baseEnvelope, backwardDir)
        val newEnvelope = builder.build()

        EnvelopeTestUtils.assertEquals(baseEnvelope, newEnvelope)
    }

    @ParameterizedTest
    @ValueSource(booleans = [false, true])
    fun noChangeTwoPartOverlay(backwardDir: Boolean) {
        //  +==============+==============+
        //  0              8              16
        val baseEnvelope =
            make(
                EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 8.0), doubleArrayOf(1.0, 1.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(8.0, 16.0), doubleArrayOf(2.0, 2.0)),
            )

        val builder = OverlayEnvelopeBuilder.withDirection(baseEnvelope, backwardDir)
        val newEnvelope = builder.build()

        EnvelopeTestUtils.assertEquals(baseEnvelope, newEnvelope)
    }

    @Test
    fun testConstantSpeedOverlay() {
        //  +====+=====+====+ <= base
        //        \   /  <= overlay
        //          +
        //  0    3  4  5    8
        val constSpeedPart =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 8.0), doubleArrayOf(2.0, 2.0))
        val constSpeedEnvelope = make(constSpeedPart)
        val builder = OverlayEnvelopeBuilder.forward(constSpeedEnvelope)
        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.COASTING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(constSpeedEnvelope, EnvelopePartConstraintType.CEILING),
                )
            overlayBuilder.initEnvelopePart(3.0, constSpeedEnvelope.interpolateSpeed(3.0), 1.0)
            Assertions.assertTrue(overlayBuilder.addStep(4.0, 1.0))
            Assertions.assertFalse(overlayBuilder.addStep(5.0, 4.0))
            builder.addPart(partBuilder.build())
        }
        val envelope = builder.build()
        Assertions.assertEquals(3, envelope.size())
        Assertions.assertEquals(1.0, envelope.get(1).minSpeed)
        Assertions.assertEquals(2.0, envelope.get(1).maxSpeed)
        Assertions.assertTrue(envelope.continuous)

        val expectedFirst =
            constSpeedPart.sliceBeginning(constSpeedPart.findLeft(3.0), 3.0, Double.NaN)
        EnvelopeTestUtils.assertEquals(expectedFirst, envelope.get(0))
    }

    @Test
    fun testMultipleOverlays() {
        val constSpeedPart =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 8.0), doubleArrayOf(2.0, 2.0))
        val constSpeedEnvelope = make(constSpeedPart)
        val builder = OverlayEnvelopeBuilder.forward(constSpeedEnvelope)

        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.COASTING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(constSpeedEnvelope, EnvelopePartConstraintType.CEILING),
                )
            overlayBuilder.initEnvelopePart(0.0, constSpeedEnvelope.interpolateSpeed(0.0), 1.0)
            Assertions.assertTrue(overlayBuilder.addStep(1.0, 1.0))
            Assertions.assertFalse(overlayBuilder.addStep(3.0, 2.0))
            builder.addPart(partBuilder.build())
        }

        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.COASTING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(constSpeedEnvelope, EnvelopePartConstraintType.CEILING),
                )
            overlayBuilder.initEnvelopePart(6.0, constSpeedEnvelope.interpolateSpeed(6.0), 1.0)
            Assertions.assertTrue(overlayBuilder.addStep(7.0, 1.0))
            Assertions.assertFalse(overlayBuilder.addStep(8.0, 2.0))
            builder.addPart(partBuilder.build())
        }

        val envelope = builder.build()
        Assertions.assertEquals(3, envelope.size())
        Assertions.assertTrue(envelope.continuous)

        EnvelopeTestUtils.assertEquals(constSpeedPart.slice(0, 3.0, 0, 6.0), envelope.get(1))
    }

    @ParameterizedTest
    @ValueSource(booleans = [false, true])
    fun testSymmetricOverlay(backwardDir: Boolean) {
        val constSpeedPart =
            generateTimes(
                listOf(TestAttr.B, EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, 3.5, 8.0),
                doubleArrayOf(2.0, 2.0, 2.0),
            )
        val overlayPoints =
            if (backwardDir) doubleArrayOf(5.0, 4.0, 3.0) else doubleArrayOf(3.0, 4.0, 5.0)
        val constSpeedEnvelope = make(constSpeedPart)
        val builder = OverlayEnvelopeBuilder.withDirection(constSpeedEnvelope, backwardDir)

        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(TestAttr.A)
            partBuilder.setAttr(EnvelopeProfile.COASTING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(constSpeedEnvelope, EnvelopePartConstraintType.CEILING),
                )
            overlayBuilder.initEnvelopePart(
                overlayPoints[0],
                2.0,
                (if (backwardDir) -1 else 1).toDouble(),
            )
            Assertions.assertTrue(overlayBuilder.addStep(overlayPoints[1], 1.0))
            Assertions.assertFalse(overlayBuilder.addStep(overlayPoints[2], 2.0))
            builder.addPart(partBuilder.build())
        }

        val envelope = builder.build()
        Assertions.assertEquals(3, envelope.size())
        Assertions.assertTrue(envelope.continuous)

        val expectedFirst =
            constSpeedPart.sliceBeginning(constSpeedPart.findLeft(3.0), 3.0, Double.NaN)
        EnvelopeTestUtils.assertEquals(expectedFirst, envelope.get(0))
        val expectedMid =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.COASTING),
                doubleArrayOf(3.0, 4.0, 5.0),
                doubleArrayOf(2.0, 1.0, 2.0),
            )
        EnvelopeTestUtils.assertEquals(expectedMid, envelope.get(1))
        val expectedLast = constSpeedPart.sliceEnd(constSpeedPart.findRight(5.0), 5.0, Double.NaN)
        EnvelopeTestUtils.assertEquals(expectedLast, envelope.get(2))
    }

    @ParameterizedTest
    @ValueSource(booleans = [false, true])
    fun testBaseCurveSplit(isBackward: Boolean) {
        // 4 +===+=======+=======+===+ <= base
        //            \        /
        //             \     / <== overlay
        //              \  /
        //               +
        //    0  1   3   4   5   6   8
        val baseEnvelope =
            make(
                EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 1.0), doubleArrayOf(4.0, 4.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(1.0, 4.0), doubleArrayOf(4.0, 4.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(4.0, 6.0), doubleArrayOf(4.0, 4.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(6.0, 8.0), doubleArrayOf(4.0, 4.0)),
            )

        val builder = OverlayEnvelopeBuilder.withDirection(baseEnvelope, isBackward)
        val cursor = EnvelopeCursor(baseEnvelope, isBackward)
        val positions = doubleArrayOf(3.0, 4.0, 6.0)
        val speeds = doubleArrayOf(4.0, 3.0, 4.0)
        builder.addPart(
            EnvelopeTestUtils.buildContinuous(
                cursor,
                listOf(EnvelopeProfile.COASTING),
                positions,
                speeds,
                isBackward,
            )
        )
        val envelope = builder.build()
        Assertions.assertEquals(4, envelope.size())
        Assertions.assertTrue(envelope.continuous)
    }

    @Test
    fun testDiscontinuityOverlayEnd() {
        // 6 ======+===+       +===+==== <= base
        //      -------- <= overlay
        // 4           +===+===+ <= base
        //   0  1  2   4   5   6   8   10
        val baseEnvelope =
            make(
                EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 2.0), doubleArrayOf(6.0, 6.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(2.0, 4.0), doubleArrayOf(6.0, 6.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(4.0, 5.0), doubleArrayOf(4.0, 4.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(5.0, 6.0), doubleArrayOf(4.0, 4.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(6.0, 8.0), doubleArrayOf(6.0, 6.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(8.0, 10.0), doubleArrayOf(6.0, 6.0)),
            )

        val builder = OverlayEnvelopeBuilder.forward(baseEnvelope)

        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.BRAKING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(baseEnvelope, EnvelopePartConstraintType.CEILING),
                )
            overlayBuilder.initEnvelopePart(
                1.0,
                baseEnvelope.interpolateSpeedLeftDir(1.0, 1.0),
                1.0,
            )
            Assertions.assertFalse(overlayBuilder.addStep(5.0, 5.0))
            builder.addPart(partBuilder.build())
        }

        val forwardEnvelope = builder.build()
        Assertions.assertEquals(6, forwardEnvelope.size())
        Assertions.assertFalse(forwardEnvelope.continuous)
    }

    @ParameterizedTest
    @ValueSource(booleans = [false, true])
    fun testLongOverlay(reverse: Boolean) {
        // 4 +===+=======+=======+===+ <== base
        //            \         /
        //             \       / <== overlay
        //              \     /
        //               +---+
        //    0  1   3   4   5   6   8
        val baseEnvelope =
            make(
                EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 1.0), doubleArrayOf(4.0, 4.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(1.0, 4.0), doubleArrayOf(4.0, 4.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(4.0, 6.0), doubleArrayOf(4.0, 4.0)),
                EnvelopeTestUtils.generateTimes(doubleArrayOf(6.0, 8.0), doubleArrayOf(4.0, 4.0)),
            )

        val builder = OverlayEnvelopeBuilder.withDirection(baseEnvelope, reverse)
        val cursor = EnvelopeCursor(baseEnvelope, reverse)
        val positions = doubleArrayOf(3.0, 4.0, 5.0, 6.0)
        val speeds = doubleArrayOf(4.0, 3.0, 3.0, 4.0)
        builder.addPart(
            EnvelopeTestUtils.buildContinuous(
                cursor,
                listOf(EnvelopeProfile.COASTING),
                positions,
                speeds,
                reverse,
            )
        )
        val envelope = builder.build()
        Assertions.assertEquals(4, envelope.size())
        Assertions.assertTrue(envelope.continuous)
    }

    @Test
    fun testUnlikelyIntersection() {
        val inputEnvelope =
            make(
                EnvelopeTestUtils.generateTimes(
                    doubleArrayOf(0.0, 3.0, 4.0),
                    doubleArrayOf(2.0, 1.0, 0.0),
                )
            )

        val builder = OverlayEnvelopeBuilder.forward(inputEnvelope)

        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.COASTING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(inputEnvelope, EnvelopePartConstraintType.CEILING),
                )
            overlayBuilder.initEnvelopePart(0.0, inputEnvelope.interpolateSpeed(1.0), 1.0)
            Assertions.assertTrue(overlayBuilder.addStep(1.0, 1.0))
            Assertions.assertFalse(overlayBuilder.addStep(4.0, 1.0))
            builder.addPart(partBuilder.build())
        }

        val envelope = builder.build()
        Assertions.assertEquals(2, envelope.size())
        Assertions.assertTrue(envelope.continuous)
    }

    @Test
    fun testIncreasingContinuousOverlay() {
        val inputEnvelope =
            make(
                EnvelopeTestUtils.generateTimes(
                    doubleArrayOf(0.0, 2.0, 4.0),
                    doubleArrayOf(1.0, 1.0, 3.0),
                )
            )

        val builder = OverlayEnvelopeBuilder.forward(inputEnvelope)

        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.ACCELERATING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(inputEnvelope, EnvelopePartConstraintType.CEILING),
                )
            overlayBuilder.initEnvelopePart(2.0, inputEnvelope.interpolateSpeed(2.0), 1.0)
            Assertions.assertTrue(overlayBuilder.addStep(3.0, 2.0))
            Assertions.assertFalse(overlayBuilder.addStep(4.0, 3.0))
            builder.addPart(partBuilder.build())
        }

        val envelope = builder.build()
        Assertions.assertEquals(2, envelope.size())
        Assertions.assertTrue(envelope.continuous)
    }

    /** Testing around edge cases with overlays that stop within the first step */
    @Test
    fun interruptedAtStart() {
        //  +==============+
        //  0              8
        val baseEnvelope =
            make(EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 8.0), doubleArrayOf(1.0, 1.0)))

        // Constraint has been broken immediately after start, part with no step
        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.ACCELERATING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(baseEnvelope, EnvelopePartConstraintType.CEILING),
                )
            Assertions.assertTrue(overlayBuilder.initEnvelopePart(0.0, 1.0, 1.0))
            Assertions.assertTrue(overlayBuilder.addStep(0.0, 1.0))
            Assertions.assertFalse(overlayBuilder.addStep(1.0, 2.0))
            val res = partBuilder.build()
            Assertions.assertEquals(0, res.stepCount())
        }

        // Constraint has been broken within the first step, part with one (partial) step
        run {
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.ACCELERATING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    EnvelopeConstraint(baseEnvelope, EnvelopePartConstraintType.CEILING),
                )
            Assertions.assertTrue(overlayBuilder.initEnvelopePart(0.0, 0.5, 1.0))
            Assertions.assertTrue(overlayBuilder.addStep(0.0, 0.5))
            Assertions.assertFalse(overlayBuilder.addStep(1.0, 5.0))
            val res = partBuilder.build()
            Assertions.assertEquals(1, res.stepCount())
            Assertions.assertTrue(res.getPointPos(1) < 1)
        }
    }
}
