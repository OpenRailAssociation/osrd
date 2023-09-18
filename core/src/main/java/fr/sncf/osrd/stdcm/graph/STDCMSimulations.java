package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.api.pathfinding.PathfindingUtils.makePath;
import static fr.sncf.osrd.api.pathfinding.PathfindingUtils.makePathFromBlocks;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;
import static fr.sncf.osrd.envelope_sim_infra.MRSP.computeMRSP;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.stdcm.BacktrackingEnvelopeAttr;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.units.Distance;

import java.util.List;
import java.util.Map;

/** This class contains all the methods used to simulate the train behavior. */
public class STDCMSimulations {
    /** Create an EnvelopeSimContext instance from the blocks and extra parameters.
     * offsetFirstBlock is in millimeters. */
    static EnvelopeSimContext makeSimContext(
            RawSignalingInfra rawInfra,
            BlockInfra blockInfra,
            List<Integer> blocks,
            long offsetFirstBlock,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep
    ) {
        var path = makePathFromBlocks(rawInfra, blockInfra, blocks, offsetFirstBlock);
        var envelopePath = EnvelopeTrainPath.from(path);
        return EnvelopeSimContextBuilder.build(rollingStock, envelopePath, timeStep, comfort);
    }

    /**
     * Returns an envelope matching the given block. The envelope time starts when the train enters the block.
     * stopPosition specifies the position at which the train should stop, may be null (no stop)
     * start is in millimeters
     * <p>
     * Note: there are some approximations made here as we only "see" the tracks on the given blocks.
     * We are missing slopes and speed limits from earlier in the path.
     * </p>
     */
    public static Envelope simulateBlock(
            RawSignalingInfra rawInfra,
            BlockInfra blockInfra,
            Integer blockId,
            double initialSpeed,
            long start,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep,
            Long stopPosition,
            String trainTag
    ) {
        if (stopPosition != null && Math.abs(stopPosition) < POSITION_EPSILON)
            return makeSinglePointEnvelope(0);
        if (start >= blockInfra.getBlockLength(blockId))
            return makeSinglePointEnvelope(initialSpeed);
        var context = makeSimContext(rawInfra, blockInfra, List.of(blockId), start, rollingStock, comfort, timeStep);
        double[] stops = new double[]{};
        if (stopPosition != null) {
            stops = new double[]{Distance.toMeters(stopPosition)};
        }
        var path = makePath(blockInfra, rawInfra, blockId);
        var mrsp = computeMRSP(path, rollingStock, false, trainTag);
        try {
            var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
            return MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope);
        } catch (OSRDError e) {
            // The train can't reach its destination, for example because of high slopes
            return null;
        }
    }

    /**
     * Make an envelope with a single point of the given speed
     */
    private static Envelope makeSinglePointEnvelope(double speed) {
        return Envelope.make(new EnvelopePart(
                Map.of(),
                new double[]{0},
                new double[]{speed},
                new double[]{}
        ));
    }

    /**
     * Returns the time at which the offset on the given block is reached
     */
    public static double interpolateTime(
            Envelope envelope,
            long envelopeStartOffset,
            long blockOffset,
            double startTime,
            double speedRatio
    ) {
        var envelopeOffset = Math.max(0, blockOffset - envelopeStartOffset);
        assert envelopeOffset <= Distance.fromMeters(envelope.getEndPos());
        return startTime + (envelope.interpolateTotalTime(Distance.toMeters(envelopeOffset)) / speedRatio);
    }

    /**
     * Try to apply an allowance on the given envelope to add the given delay
     */
    static Envelope findEngineeringAllowance(EnvelopeSimContext context, Envelope oldEnvelope, double neededDelay) {
        neededDelay += context.timeStep; // error margin for the dichotomy
        var ranges = List.of(
                new AllowanceRange(0, oldEnvelope.getEndPos(), new AllowanceValue.FixedTime(neededDelay))
        );
        var capacitySpeedLimit = 1; // We set a minimum because generating curves at very low speed can cause issues
        // TODO: add a parameter and set a higher default value once we can handle proper stops
        var allowance = new MarecoAllowance(0, oldEnvelope.getEndPos(), capacitySpeedLimit, ranges);
        try {
            return allowance.apply(oldEnvelope, context);
        } catch (OSRDError e) {
            return null;
        }
    }


    /**
     * returns an envelope for a block that already has an envelope, but with a different end speed
     */
    static Envelope simulateBackwards(
            RawSignalingInfra rawInfra,
            BlockInfra blockInfra,
            Integer blockId,
            double endSpeed,
            long start,
            Envelope oldEnvelope,
            STDCMGraph graph
    ) {
        var context = makeSimContext(
                rawInfra,
                blockInfra,
                List.of(blockId),
                start,
                graph.rollingStock,
                graph.comfort,
                graph.timeStep
        );
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.BRAKING);
        partBuilder.setAttr(new BacktrackingEnvelopeAttr());
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(oldEnvelope, CEILING)
        );
        EnvelopeDeceleration.decelerate(
                context,
                oldEnvelope.getEndPos(),
                endSpeed,
                overlayBuilder,
                -1
        );
        var builder = OverlayEnvelopeBuilder.backward(oldEnvelope);
        builder.addPart(partBuilder.build());
        return builder.build();
    }
}
