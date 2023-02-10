package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import java.util.List;
import java.util.function.BiConsumer;

public class TestMRSPBuilder {
    /** Builds a constant speed MRSP for a given path */
    public static Envelope makeSimpleMRSP(EnvelopeSimContext context,
                                          double speed) {
        var builder = new MRSPEnvelopeBuilder();
        var maxSpeedRS = context.rollingStock.getMaxSpeed();
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED),
                new double[] {0, context.path.getLength()},
                new double[] {maxSpeedRS, maxSpeedRS}
        ));
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED),
                new double[] {0, context.path.getLength()},
                new double[] {speed, speed}
        ));
        return builder.build();
    }

    /** Builds a funky MRSP for a given path */
    public static Envelope makeComplexMRSP(EnvelopeSimContext context) {
        assert context.path.getLength() >= 100000 :
                "Path length must be greater than 100km to generate a complex MRSP";
        var builder = new MRSPEnvelopeBuilder();
        var maxSpeedRS = context.rollingStock.getMaxSpeed();
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED),
                new double[]{0, context.path.getLength()},
                new double[]{maxSpeedRS, maxSpeedRS}
        ));

        BiConsumer<double[], double[]> addSpeedLimit = (double[] positions, double[] speeds) ->
                builder.addPart(EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.CONSTANT_SPEED),
                        positions, speeds
                ));

        addSpeedLimit.accept(new double[] {0, 10000 }, new double[] {44.4, 44.4});
        addSpeedLimit.accept(new double[] {10000, 20000 }, new double[] {64.4, 64.4});
        addSpeedLimit.accept(new double[] {20000, 50000 }, new double[] {54.4, 54.4});
        addSpeedLimit.accept(new double[] {50000, 55000 }, new double[] {14.4, 14.4});
        addSpeedLimit.accept(new double[] {55000, 70000 }, new double[] {54.4, 54.4});
        addSpeedLimit.accept(new double[] {70000, 75000 }, new double[] {74.4, 74.4});
        addSpeedLimit.accept(new double[] {75000, context.path.getLength() }, new double[] {44.4, 44.4});
        return builder.build();
    }
}
