package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;
import java.util.List;

public class STDCMSimulation {
    static final Logger logger = LoggerFactory.getLogger(STDCMSimulation.class);

    public static final record DelayRange(double begin, double end, double delay) {}

    /** Finds an envelope matching the given delays */
    public static Envelope makeSTDCMEnvelope(
            RollingStock rollingStock,
            EnvelopePath envelopePath,
            List<BlockUse> stdcmPath,
            TrainPath trainPath,
            double startTime,
            double timeStep,
            Envelope mrsp,
            StandaloneTrainSchedule trainSchedule
    ) {
        var baseEnvelope = StandaloneSim.computeMaxEffortEnvelope(mrsp, timeStep, envelopePath, trainSchedule);
        var delays = makeDelayRanges(envelopePath, stdcmPath, trainPath, baseEnvelope, startTime);
        var allowance = new MarecoAllowance(
                new EnvelopeSimContext(rollingStock, envelopePath, timeStep),
                0,
                envelopePath.length,
                0,
                convertRanges(delays)
        );
        return StandaloneSim.applyAllowances(baseEnvelope, List.of(allowance));
    }

    /** Converts the given RangeMap into a list of AllowanceRange */
    private static List<AllowanceRange> convertRanges(List<DelayRange> ranges) {
        var res = new ArrayList<AllowanceRange>();
        for (var range : ranges) {
            var allowanceValue = new AllowanceValue.FixedTime(range.delay());
            res.add(new AllowanceRange(range.begin, range.end, allowanceValue));
        }
        return res;
    }

    /** Finds the minimum delay we need to add in every range */
    public static List<DelayRange> makeDelayRanges(
            EnvelopePath envelopePath,
            List<BlockUse> stdcmPath,
            TrainPath trainPath,
            Envelope baseEnvelope,
            double startTime
    ) {
        // Step 1: find the position of block starts in the envelope path
        double[] blockBounds = new double[stdcmPath.size() + 1];
        assert trainPath.routePath().size() == stdcmPath.size();
        var routePath = trainPath.routePath();
        for (int i = 0; i < routePath.size(); i++)
            blockBounds[i] = routePath.get(i).pathOffset();
        blockBounds[0] = 0.;
        blockBounds[stdcmPath.size()] = envelopePath.length;

        // Step 2: compile the times at which the train would reach each block start without margins
        double[] blockEntryTimes = new double[stdcmPath.size()];
        for (int i = 0; i < stdcmPath.size(); i++)
            blockEntryTimes[i] = baseEnvelope.interpolateTotalTime(blockBounds[i]);

        // Step 3: add margins so the train reaches its block in the allotted time range
        var allowanceRanges = new ArrayList<DelayRange>();
        var totalDelay = 0.;
        var endLastRange = 0.;
        for (int i = 0; i < stdcmPath.size(); i++) {
            var simulatedEntryTime = startTime + blockEntryTimes[i] + totalDelay;
            var allowedEntryTime = stdcmPath.get(i).reservationStartTime;
            logger.info("block {}: sim entry time {}, allowed time {}", i, simulatedEntryTime, allowedEntryTime);
            if (simulatedEntryTime < allowedEntryTime) {
                var blockDelay = allowedEntryTime - simulatedEntryTime + 1.;
                totalDelay += blockDelay;
                allowanceRanges.add(new DelayRange(endLastRange, blockBounds[i], blockDelay));
                logger.info("\t\tadding {}s of delay from position {} to {}",
                        blockDelay, endLastRange, blockBounds[i]);
                endLastRange = blockBounds[i];
            }
        }
        allowanceRanges.add(new DelayRange(endLastRange, baseEnvelope.getEndPos(), 0));
        return allowanceRanges;
    }
}
