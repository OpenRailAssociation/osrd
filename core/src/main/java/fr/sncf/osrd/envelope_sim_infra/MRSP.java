package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.utils.JavaInteroperabilityToolsKt.rangeMapEntryToSpeed;
import static fr.sncf.osrd.utils.units.Distance.toMeters;
import static fr.sncf.osrd.utils.units.Speed.toMetersPerSecond;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.sim_infra.api.SpeedLimitTagHandlingPolicy;
import java.util.List;

/** MRSP = most restrictive speed profile: maximum speed allowed at any given point. */
public class MRSP {

    /**
     * Computes the MSRP for a rolling stock on a given path.
     *
     * @param path corresponding path.
     * @param rollingStock corresponding rolling stock.
     * @param addRollingStockLength whether the rolling stock length should be taken into account in
     *     the computation.
     * @param trainTag corresponding train.
     * @param tagPolicy the policy to be applied when processing speed-limits from trainTag.
     * @return the corresponding MRSP as an Envelope.
     */
    public static Envelope computeMRSP(
            PathProperties path,
            PhysicsRollingStock rollingStock,
            boolean addRollingStockLength,
            String trainTag,
            SpeedLimitTagHandlingPolicy tagPolicy) {
        return computeMRSP(
                path, rollingStock.getMaxSpeed(), rollingStock.getLength(), addRollingStockLength, trainTag, tagPolicy);
    }

    /**
     * Computes the MSRP for a rolling stock on a given path.
     *
     * @param path corresponding path.
     * @param rsMaxSpeed rolling stock max speed (m/s)
     * @param rsLength length of the rolling stock (m)
     * @param addRollingStockLength whether the rolling stock length should be taken into account in
     *     the computation.
     * @param trainTag corresponding train.
     * @return the corresponding MRSP as an Envelope.
     */
    public static Envelope computeMRSP(
            PathProperties path,
            double rsMaxSpeed,
            double rsLength,
            boolean addRollingStockLength,
            String trainTag,
            SpeedLimitTagHandlingPolicy tagPolicy) {
        var builder = new MRSPEnvelopeBuilder();
        var pathLength = toMeters(path.getLength());

        // Add a limit corresponding to the hardware's maximum operational speed
        builder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.TRAIN_LIMIT),
                new double[] {0, pathLength},
                new double[] {rsMaxSpeed, rsMaxSpeed}));

        var offset = addRollingStockLength ? rsLength : 0.;
        var speedLimits = path.getSpeedLimits(trainTag, tagPolicy);
        for (var speedLimit : speedLimits) {
            // Compute where this limit is active from and to
            var start = toMeters(speedLimit.getLower());
            var end = Math.min(pathLength, offset + toMeters(speedLimit.getUpper()));
            var speed = toMetersPerSecond(rangeMapEntryToSpeed(speedLimit));
            if (speed != 0)
                // Add the envelope part corresponding to the restricted speed section
                builder.addPart(EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.SPEED_LIMIT),
                        new double[] {start, end},
                        new double[] {speed, speed}));
        }
        return builder.build();
    }
}
