package fr.sncf.osrd.standalone_sim;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.reporting.ErrorContext;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
import fr.sncf.osrd.standalone_sim.result.ResultModeAndProfilePoint;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import java.util.HashMap;
import java.util.List;

public class StandaloneSim {
    /**
     * Runs a batch of standalone simulations for multiple trains.
     * Interactions between trains are ignored.
     */
    public static StandaloneSimResult run(
            SignalingInfra infra,
            TrainPath trainPath,
            EnvelopeSimPath envelopeSimPath,
            List<StandaloneTrainSchedule> schedules,
            double timeStep
    ) {
        // Compute envelopes
        var result = new StandaloneSimResult();
        var cacheSpeedLimits = new HashMap<StandaloneTrainSchedule, List<ResultEnvelopePoint>>();
        var cacheMaxEffort = new HashMap<StandaloneTrainSchedule, ResultTrain>();
        var cacheEco = new HashMap<StandaloneTrainSchedule, ResultTrain>();
        var cacheModeAndProfiles = new HashMap<StandaloneTrainSchedule, List<ResultModeAndProfilePoint>>();
        for (var trainSchedule : schedules) {
            if (!cacheMaxEffort.containsKey(trainSchedule)) {
                var rollingStock = trainSchedule.rollingStock;
                // MRSP & SpeedLimits
                var mrsp = MRSP.from(trainPath, rollingStock, true, trainSchedule.tag);
                var speedLimits = MRSP.from(trainPath, rollingStock, false, trainSchedule.tag);
                cacheSpeedLimits.put(trainSchedule, ResultEnvelopePoint.from(speedLimits));

                // Base
                var modeAndProfileMap = envelopeSimPath.getModeAndProfileMap(
                        trainSchedule.options.ignoreElectricalProfiles ? null : rollingStock.powerClass);
                var curvesAndConditions = rollingStock.mapTractiveEffortCurves(modeAndProfileMap,
                        trainSchedule.comfort, envelopeSimPath.getLength());
                var context = new EnvelopeSimContext(rollingStock, envelopeSimPath, timeStep,
                        curvesAndConditions.curves());
                cacheModeAndProfiles.put(trainSchedule, ResultModeAndProfilePoint.from(
                        curvesAndConditions.conditions(), modeAndProfileMap));
                var envelope = computeMaxEffortEnvelope(context, mrsp, trainSchedule);
                var simResultTrain = ScheduleMetadataExtractor.run(
                        envelope,
                        trainPath,
                        trainSchedule,
                        infra);
                cacheMaxEffort.put(trainSchedule, simResultTrain);

                // Eco
                if (!trainSchedule.allowances.isEmpty()) {
                    var ecoEnvelope = applyAllowances(envelope, trainSchedule.allowances);
                    var simEcoResultTrain = ScheduleMetadataExtractor.run(
                            ecoEnvelope,
                            trainPath,
                            trainSchedule,
                            infra);
                    cacheEco.put(trainSchedule, simEcoResultTrain);
                }
            }

            result.speedLimits.add(cacheSpeedLimits.get(trainSchedule));
            result.baseSimulations.add(cacheMaxEffort.get(trainSchedule));
            result.ecoSimulations.add(cacheEco.getOrDefault(trainSchedule, null));
            result.modesAndProfiles.add(cacheModeAndProfiles.get(trainSchedule));
        }
        return result;
    }

    /**
     * Compute the max effort envelope given a path, MRSP and a schedule
     */
    public static Envelope computeMaxEffortEnvelope(
            EnvelopeSimContext context,
            Envelope mrsp,
            StandaloneTrainSchedule schedule
    ) {
        final var stops = schedule.getStopsPositions();
        final var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
        return MaxEffortEnvelope.from(context, schedule.initialSpeed, maxSpeedEnvelope);
    }

    /**
     * Apply a list of allowances, in order
     */
    public static Envelope applyAllowances(
            Envelope maxEffortEnvelope,
            List<? extends Allowance> allowances
    ) {
        var result = maxEffortEnvelope;
        for (int i = 0; i < allowances.size(); i++) {
            try {
                result = allowances.get(i).apply(result);
            } catch (OSRDError e) {
                throw e.withContext(new ErrorContext.Allowance(i));
            }
        }
        return result;
    }
}
