package fr.sncf.osrd.envelope_sim_infra;

import static java.lang.Math.max;
import static java.lang.Math.min;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.utils.DoubleUtils;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.List;

/** MRSP = most restrictive speed profile: maximum speed allowed at any given point */
public class MRSP {
    public enum LimitKind implements EnvelopeAttr {
        SPEED_LIMIT,
        TRAIN_LIMIT,
        ;

        @Override
        public Class<? extends EnvelopeAttr> getAttrType() {
            return LimitKind.class;
        }
    }

    /** Computes the most restricted speed profile */
    public static Envelope from(TrainPath trainPath, RollingStock rollingStock) {
        var builder = new MRSPEnvelopeBuilder();

        // add a limit for the maximum speed the hardware is rated for
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, LimitKind.TRAIN_LIMIT),
                new double[] { 0, trainPath.length },
                new double[] { rollingStock.maxSpeed, rollingStock.maxSpeed }
        ));

        var offset = 0;
        for (var trackSectionRange : trainPath.trackSectionPath) {
            var edge = trackSectionRange.edge;
            for (var speedRange : TrackSection.getSpeedSections(edge, trackSectionRange.direction)) {
                // ignore the speed limit if it doesn't apply to our train
                var speedSection = speedRange.value;
                if (!speedSection.isValidFor(rollingStock))
                    continue;

                var speedRangeBegin = min(speedRange.begin, speedRange.end);
                var speedRangeEnd = max(speedRange.begin, speedRange.end);
                var beginOnRange = 0.;
                if (trackSectionRange.direction == EdgeDirection.START_TO_STOP) {
                    beginOnRange = DoubleUtils.clamp(
                            speedRangeBegin - trackSectionRange.getBeginPosition(), 0, trackSectionRange.length());
                } else {
                    beginOnRange = DoubleUtils.clamp(
                            trackSectionRange.getBeginPosition() - speedRangeEnd, 0, trackSectionRange.length());
                }
                var endOnRange = DoubleUtils.clamp(
                        beginOnRange + speedRangeEnd - speedRangeBegin, 0, trackSectionRange.length());

                if (Double.compare(beginOnRange, endOnRange) == 0)
                    continue;

                // compute where this limit is active from and to
                var begin = offset + beginOnRange;
                var end = offset + endOnRange;

                // Add the envelope part corresponding to the restricted speed section
                builder.addPart(EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.CONSTANT_SPEED, LimitKind.SPEED_LIMIT),
                        new double[] { begin, end },
                        new double[] { speedSection.speedLimit, speedSection.speedLimit }
                ));
            }
            offset += trackSectionRange.length();
        }
        return builder.build();
    }
}
