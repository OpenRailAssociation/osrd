package fr.sncf.osrd.standalone_sim;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.reporting.ErrorContext;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.RollingStock;
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
            TrainPath trainsPath,
            List<StandaloneTrainSchedule> schedules,
            double timeStep
    ) {
        var envelopePath = EnvelopeTrainPath.from(trainsPath);

        // Compute envelopes
        var result = new StandaloneSimResult();
        var cacheSpeedLimits = new HashMap<StandaloneTrainSchedule, List<ResultEnvelopePoint>>();
        var cacheMaxEffort = new HashMap<StandaloneTrainSchedule, ResultTrain>();
        var cacheEco = new HashMap<StandaloneTrainSchedule, ResultTrain>();
        for (var trainSchedule : schedules) {
            if (!cacheMaxEffort.containsKey(trainSchedule)) {
                // MRSP & SpeedLimits
                var mrsp = MRSP.from(trainsPath, trainSchedule.rollingStock, true, trainSchedule.tags);
                var speedLimits = MRSP.from(trainsPath, trainSchedule.rollingStock, false, trainSchedule.tags);
                cacheSpeedLimits.put(trainSchedule, ResultEnvelopePoint.from(speedLimits));

                // Base
                var envelope = computeMaxEffortEnvelope(mrsp, timeStep, envelopePath, trainSchedule);
                var simResultTrain = ScheduleMetadataExtractor.run(
                        envelope,
                        trainsPath,
                        trainSchedule,
                        infra);
                cacheMaxEffort.put(trainSchedule, simResultTrain);

                // Eco
                if (!trainSchedule.allowances.isEmpty()) {
                    var ecoEnvelope = applyAllowances(envelope, trainSchedule.allowances);
                    var simEcoResultTrain = ScheduleMetadataExtractor.run(
                            ecoEnvelope,
                            trainsPath,
                            trainSchedule,
                            infra);
                    cacheEco.put(trainSchedule, simEcoResultTrain);
                }
            }

            result.speedLimits.add(cacheSpeedLimits.get(trainSchedule));
            result.baseSimulations.add(cacheMaxEffort.get(trainSchedule));
            result.ecoSimulations.add(cacheEco.getOrDefault(trainSchedule, null));
        }
        return result;
    }

    /** Compute the max effort envelope given a path, MRSP and a schedule */
    public static Envelope computeMaxEffortEnvelope(
            Envelope mrsp,
            double timeStep,
            EnvelopePath envelopePath,
            StandaloneTrainSchedule schedule
    ) {
        final var rollingStock = schedule.rollingStock;
        final var stops = schedule.getStopsPositions();
        final var context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep, schedule.comfort);
        final var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
        return MaxEffortEnvelope.from(context, schedule.initialSpeed, maxSpeedEnvelope);
    }

    /** Apply a list of allowances, in order */
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
