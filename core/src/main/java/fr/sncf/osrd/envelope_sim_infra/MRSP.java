package fr.sncf.osrd.envelope_sim_infra;

import static java.lang.Math.max;
import static java.lang.Math.min;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.new_infra_state.api.NewTrainPath;
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

    /** Computes the most restricted speed profile from a path */
    public static Envelope from(NewTrainPath trainPath, RollingStock rollingStock) {
        return from(NewTrainPath.removeLocation(trainPath.trackRangePath()), rollingStock);
    }

    /** Computes the most restricted speed profile from a list of track ranges */
    public static Envelope from(List<TrackRangeView> ranges, RollingStock rollingStock) {
        var builder = new MRSPEnvelopeBuilder();
        var pathLength = ranges.stream().mapToDouble(TrackRangeView::getLength).sum();

        // add a limit for the maximum speed the hardware is rated for
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, LimitKind.TRAIN_LIMIT),
                new double[] { 0, pathLength },
                new double[] { rollingStock.maxSpeed, rollingStock.maxSpeed }
        ));

        var offset = 0.;
        for (var range : ranges) {
            if (range.getLength() > 0) {
                for (var speedRange : range.getSpeedSections().getValuesInRange(0, range.getLength()).entrySet()) {
                    // compute where this limit is active from and to
                    var interval = speedRange.getKey();
                    var begin = offset + interval.getBeginPosition();
                    var end = offset + interval.getEndPosition();
                    var speed = speedRange.getValue();
                    if (speed.isInfinite() || speed == 0)
                        continue;

                    // Add the envelope part corresponding to the restricted speed section
                    builder.addPart(EnvelopePart.generateTimes(
                            List.of(EnvelopeProfile.CONSTANT_SPEED, LimitKind.SPEED_LIMIT),
                            new double[]{begin, end},
                            new double[]{speed, speed}
                    ));
                }
                offset += range.getLength();
            }
        }
        return builder.build();
    }
}
