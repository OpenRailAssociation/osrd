package fr.sncf.osrd.envelope_sim_infra;

import com.google.common.collect.Range;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.train.RollingStock;
import java.util.List;

/** MRSP = most restrictive speed profile: maximum speed allowed at any given point */
public class MRSP {

    /** Computes the most restricted speed profile from a path */
    public static Envelope from(
            TrainPath trainPath,
            RollingStock rollingStock,
            boolean addRollingStockLength,
            String tag) {
        return from(TrainPath.removeLocation(trainPath.trackRangePath()), rollingStock, addRollingStockLength, tag);
    }

    /** Computes the most restricted speed profile from a list of track ranges */
    public static Envelope from(
            List<TrackRangeView> ranges,
            RollingStock rollingStock,
            boolean addRollingStockLength,
            String tag) {
        var builder = new MRSPEnvelopeBuilder();
        var pathLength = 0.;
        for (var r : ranges)
            pathLength += r.getLength();

        // add a limit for the maximum speed the hardware is rated for
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.TRAIN_LIMIT),
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
                if (addRollingStockLength) {
                    end += rollingStock.length;
                }
                begin = Math.max(0, begin);
                end = Math.min(pathLength, end);
                var speed = speedRange.getValue().getSpeedLimit(tag);
                if (Double.isInfinite(speed) || speed == 0)
                    continue;

                // Add the envelope part corresponding to the restricted speed section
                builder.addPart(EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.SPEED_LIMIT),
                        new double[]{begin, end},
                        new double[]{speed, speed}
                ));
            }
            offset += range.getLength();
        }
        return builder.build();
    }
}
