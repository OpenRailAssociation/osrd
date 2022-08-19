package fr.sncf.osrd.envelope_sim_infra.ertms.etcs;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import com.google.common.collect.Range;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.StopMeta;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.train.RollingStock;
import java.util.Collection;
import java.util.List;

public class BrakingCurves {

    /** Computes the ETCS braking curves from a path */
    public static Envelope from(
            TrainPath trainPath,
            RollingStock rollingStock,
            Collection<String> tags
    ) {
        return from(TrainPath.removeLocation(trainPath.trackRangePath()), rollingStock, tags);
    }

    /** Computes the ETCS braking curves from a list of track ranges */
    public static Envelope from(
            List<TrackRangeView> ranges,
            RollingStock rollingStock,
            Collection<String> tags
    ) {
        var builder = new MRSPEnvelopeBuilder();
        var pathLength = 0.;
        for (var r : ranges)
            pathLength += r.getLength();

        // add a limit for the maximum speed the hardware is rated for
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, MRSP.LimitKind.TRAIN_LIMIT),
                new double[] { 0, pathLength },
                new double[] { rollingStock.maxSpeed, rollingStock.maxSpeed }
        ));

        var offset = 0.;
        for (var range : ranges) {
            if (range.getLength() == 0)
                continue;
            var subMap = range.getSpeedSections().subRangeMap(Range.closed(0., range.getLength()));
            for (var speedRange : subMap.asMapOfRanges().entrySet()) {
                // compute where this limit is active from and to
                var interval = speedRange.getKey();
                var begin = offset + interval.lowerEndpoint();
                var end = offset + interval.upperEndpoint();
                var speed = speedRange.getValue().getSpeedLimit(tags);
                if (Double.isInfinite(speed) || speed == 0)
                    continue;

                // Add the envelope part corresponding to the restricted speed section
                builder.addPart(EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.CONSTANT_SPEED, MRSP.LimitKind.SPEED_LIMIT),
                        new double[]{begin, end},
                        new double[]{speed, speed}
                ));
            }
            offset += range.getLength();
        }
        return builder.build();
    }

    /**
     * EBD = Emergency Brake Deceleration
     */
    private EnvelopePart computeEBD(EnvelopeSimContext context,
                                    Envelope mrsp,
                                    double targetPosition,
                                    double targetSpeed) {
        // if the stopPosition is zero, or above path length, the input is invalid
        if (targetPosition <= 0.0 || targetPosition > context.path.getLength())
            throw new RuntimeException(String.format(
                    "Trying to compute ETCS braking curve from out of bounds ERTMS marker board (position = %f,"
                    + "path length = %f)",
                    targetPosition, context.path.getLength()
            ));
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.BRAKING);
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(mrsp, CEILING)
        );
        EnvelopeDeceleration.decelerate(context, targetPosition, targetSpeed, overlayBuilder, -1);

        return partBuilder.build();
    }
}
