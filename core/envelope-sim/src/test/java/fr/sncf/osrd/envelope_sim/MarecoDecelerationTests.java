package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.TIME_STEP;
import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceConvergenceException;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import org.junit.jupiter.api.Test;
import java.util.List;

public class MarecoDecelerationTests {

    /** Try to apply a mareco allowance from start to end offset, on a path mostly made of braking curves.
     * Most of the time it fails to converge because we can't add time, we just check for other errors.
     * This triggers many edge cases. */
    public static void testDecelerationSection(double startOffset, double endOffset) {
        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var testPath = new FlatPath(100_000, 0);
        var context = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
        var mrsp = MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope(context, 1000);
        var builder = OverlayEnvelopeBuilder.backward(mrsp);
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.BRAKING);
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(mrsp, CEILING)
        );
        EnvelopeDeceleration.decelerate(context, 100_000, 0, overlayBuilder, -1);
        var envelope = builder.build();

        var allowance = new MarecoAllowance(startOffset, endOffset, 0,
                List.of(new AllowanceRange(startOffset, endOffset, new AllowanceValue.Percentage(50))));
        try {
            allowance.apply(envelope, context);
        } catch (AllowanceConvergenceException err) {
            assertEquals(AllowanceConvergenceException.ErrorType.TOO_MUCH_TIME, err.errorType);
        }
    }

    /** Reproduces a bug where the parts wouldn't be continuous */
    @Test
    public void regressionTestDiscontinuityBetweenMarecoParts() {
        testDecelerationSection(99980, 100_000);
    }

    /** Reproduces a bug where the time added is exactly one timestep away from the target time.
     * We exit the loop when the error is <= timestep, we assert that the error is < timestep. */
    @Test
    public void regressionTestWrongToleranceInAssertion() {
        testDecelerationSection(99984, 100_000);
    }

    /** Reproduces a "zero TimeDeltas" error, where a 0-length core phase is mistakenly added. */
    @Test
    public void regressionTestZeroTimedelta() {
        testDecelerationSection(99961.59999999782, 99997.59999999986);
    }

    /** Iterates over several values. It doesn't loop too many times to avoid it taking too long in the test suite,
     * but it can be tweaked to test more cases. */
    @Test
    @SuppressFBWarnings("FL_FLOATS_AS_LOOP_COUNTERS")
    public void testIteratively() {
        // Iterating by 0.1 causes float approximations and values that aren't well-rounded,
        // it helps to find some edge cases
        for (double endOffset = 100_000; endOffset > 99_990; endOffset -= 0.1) {
            for (double startOffset = endOffset - 1; startOffset > 99_990; startOffset -= 0.1) {
                testDecelerationSection(startOffset, endOffset);
            }
        }
    }
}
