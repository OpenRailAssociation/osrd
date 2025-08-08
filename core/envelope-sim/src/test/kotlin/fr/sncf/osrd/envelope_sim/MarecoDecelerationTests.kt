package fr.sncf.osrd.envelope_sim

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.allowances.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class MarecoDecelerationTests {
    /** Reproduces a bug where the parts wouldn't be continuous */
    @Test
    fun regressionTestDiscontinuityBetweenMarecoParts() {
        testDecelerationSection(99980.0, 100000.0)
    }

    /**
     * Reproduces a bug where the time added is exactly one timestep away from the target time. We
     * exit the loop when the error is <= timestep, we assert that the error is < timestep.
     */
    @Test
    fun regressionTestWrongToleranceInAssertion() {
        testDecelerationSection(99984.0, 100000.0)
    }

    /** Reproduces a "zero TimeDeltas" error, where a 0-length core phase is mistakenly added. */
    @Test
    fun regressionTestZeroTimedelta() {
        testDecelerationSection(99961.59999999782, 99997.59999999986)
    }

    /**
     * Iterates over several values. It doesn't loop too many times to avoid it taking too long in
     * the test suite, but it can be tweaked to test more cases.
     */
    @Test
    @SuppressFBWarnings("FL_FLOATS_AS_LOOP_COUNTERS")
    fun testIteratively() {
        // Iterating by 0.1 causes float approximations and values that aren't well-rounded,
        // it helps to find some edge cases
        var endOffset = 100000.0
        while (endOffset > 99990) {
            var startOffset = endOffset - 1
            while (startOffset > 99990) {
                testDecelerationSection(startOffset, endOffset)
                startOffset -= 0.1
            }
            endOffset -= 0.1
        }
    }

    companion object {
        /**
         * Try to apply a mareco allowance from start to end offset, on a path mostly made of
         * braking curves. Most of the time it fails to converge because we can't add time, we just
         * check for other errors. This triggers many edge cases.
         */
        fun testDecelerationSection(startOffset: Double, endOffset: Double) {
            val testRollingStock = SimpleRollingStock.STANDARD_TRAIN
            val testPath = FlatPath(100000.0, 0.0)
            val context =
                EnvelopeSimContext(
                    testRollingStock,
                    testPath,
                    SimpleContextBuilder.TIME_STEP,
                    SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
                )
            val mrsp = makeSimpleMaxEffortEnvelope(context, 1000.0)
            val builder = OverlayEnvelopeBuilder.backward(mrsp)
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.BRAKING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                    EnvelopeConstraint(mrsp, EnvelopePartConstraintType.CEILING),
                )
            EnvelopeDeceleration.decelerate(context, 100000.0, 0.0, overlayBuilder, -1.0)
            val envelope = builder.build()

            val allowance =
                MarecoAllowance(
                    startOffset,
                    endOffset,
                    1.0,
                    listOf(AllowanceRange(startOffset, endOffset, AllowanceValue.Percentage(50.0))),
                )
            try {
                allowance.apply(envelope, context)
            } catch (err: OSRDError) {
                Assertions.assertEquals(
                    err.osrdErrorType,
                    ErrorType.AllowanceConvergenceTooMuchTime,
                )
            }
        }
    }
}
