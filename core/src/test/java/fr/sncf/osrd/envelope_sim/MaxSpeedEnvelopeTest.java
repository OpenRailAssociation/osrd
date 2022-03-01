package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim_infra.MRSP.LimitKind.SPEED_LIMIT;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.MRSP.LimitKind;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.function.BiConsumer;


public class MaxSpeedEnvelopeTest {

    static final double TIME_STEP = 4;

    /** Builds a constant speed MRSP for a given path */
    public static Envelope makeSimpleMRSP(PhysicsRollingStock rollingStock,
                                          PhysicsPath path,
                                          double speed) {
        var builder = new MRSPEnvelopeBuilder();
        var maxSpeedRS = rollingStock.getMaxSpeed();
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, LimitKind.TRAIN_LIMIT),
                new double[] {0, path.getLength()},
                new double[] {maxSpeedRS, maxSpeedRS}
        ));
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, LimitKind.SPEED_LIMIT),
                new double[] {0, path.getLength()},
                new double[] {speed, speed}
        ));
        return builder.build();
    }

    /** Builds a funky MRSP for a given path */
    public static Envelope makeComplexMRSP(PhysicsRollingStock rollingStock,
                                           PhysicsPath path) {
        assert path.getLength() >= 100000 : "Path length must be greater than 100km to generate a complex MRSP";
        var builder = new MRSPEnvelopeBuilder();
        var maxSpeedRS = rollingStock.getMaxSpeed();
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, LimitKind.TRAIN_LIMIT),
                new double[]{0, path.getLength()},
                new double[]{maxSpeedRS, maxSpeedRS}
        ));

        BiConsumer<double[], double[]> addSpeedLimit = (double[] positions, double[] speeds) ->
                builder.addPart(EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.CONSTANT_SPEED, SPEED_LIMIT),
                        positions, speeds
                ));

        addSpeedLimit.accept(new double[] {0, 10000 }, new double[] {44.4, 44.4});
        addSpeedLimit.accept(new double[] {10000, 20000 }, new double[] {64.4, 64.4});
        addSpeedLimit.accept(new double[] {20000, 50000 }, new double[] {54.4, 54.4});
        addSpeedLimit.accept(new double[] {50000, 55000 }, new double[] {14.4, 14.4});
        addSpeedLimit.accept(new double[] {55000, 70000 }, new double[] {54.4, 54.4});
        addSpeedLimit.accept(new double[] {70000, 75000 }, new double[] {74.4, 74.4});
        addSpeedLimit.accept(new double[] {75000, path.getLength() }, new double[] {44.4, 44.4});
        return builder.build();
    }

    @Test
    public void testFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var stops = new double[] { 8500 };

        var flatMRSP = makeSimpleMRSP(testRollingStock, testPath, 44.4);
        var context = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, DECREASING, CONSTANT);
        var delta = 2 * maxSpeedEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 6529, 8500);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false);
    }

    @Test
    public void testSteep() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 20);
        var stops = new double[] { 8500 };

        var flatMRSP = makeSimpleMRSP(testRollingStock, testPath, 44.4);
        var context = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, DECREASING, CONSTANT);
        var delta = 2 * maxSpeedEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 6529, 8500);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false);
    }

    @Test
    public void testInitialStop() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var stops = new double[]{0};

        var flatMRSP = makeSimpleMRSP(testRollingStock, testPath, 44.4);
        var context = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT);
    }

    @Test
    public void testFlatNonConstDec() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
        var testPath = new FlatPath(10000, 0);
        var stops = new double[] { 8500 };

        var flatMRSP = makeSimpleMRSP(testRollingStock, testPath, 44.4);
        var context = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, DECREASING, CONSTANT);
        var delta = 2 * maxSpeedEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 7493, 8500);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false);
    }

    @Test
    public void testWithComplexMRSP() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100000, 0);
        var stops = new double[] { 50000, testPath.getLength() };

        var mrsp = makeComplexMRSP(testRollingStock, testPath);
        var context = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, CONSTANT, DECREASING, CONSTANT,
                DECREASING, CONSTANT, CONSTANT, CONSTANT, DECREASING, CONSTANT, DECREASING);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope,
                false, true, true, true, false, false, false, true, true, true);
    }
}
