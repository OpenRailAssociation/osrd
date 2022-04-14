package fr.sncf.osrd.standalone_sim;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.exceptions.ErrorContext;
import fr.sncf.osrd.exceptions.OSRDError;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
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
            RJSTrainPath rjsTrainsPath,
            TrainPath trainsPath,
            List<StandaloneTrainSchedule> schedules,
            double timeStep
    ) {
        var envelopePath = EnvelopeTrainPath.from(trainsPath);

        // Compute envelopes
        var result = new StandaloneSimResult();
        var cacheMRSP = new HashMap<StandaloneTrainSchedule, List<ResultEnvelopePoint>>();
        var cacheMaxEffort = new HashMap<StandaloneTrainSchedule, ResultTrain>();
        var cacheEco = new HashMap<StandaloneTrainSchedule, ResultTrain>();
        for (var trainSchedule : schedules) {
            if (!cacheMaxEffort.containsKey(trainSchedule)) {
                // MRSP
                var mrsp = MRSP.from(trainsPath, trainSchedule.rollingStock);
                cacheMRSP.put(trainSchedule, ResultEnvelopePoint.from(mrsp));

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
                    var ecoEnvelope = applyAllowances(envelope, trainSchedule);
                    var simEcoResultTrain = ScheduleMetadataExtractor.run(
                            ecoEnvelope,
                            trainsPath,
                            trainSchedule,
                            infra);
                    cacheEco.put(trainSchedule, simEcoResultTrain);
                }
            }

            result.mrsps.add(cacheMRSP.get(trainSchedule));
            result.baseSimulations.add(cacheMaxEffort.get(trainSchedule));
            result.ecoSimulations.add(cacheEco.getOrDefault(trainSchedule, null));
        }
        return result;
    }

    private static Envelope computeMaxEffortEnvelope(
            Envelope mrsp,
            double timeStep,
            EnvelopePath envelopePath,
            StandaloneTrainSchedule schedule
    ) {
        final var rollingStock = schedule.rollingStock;
        final var stops = schedule.getStopsPositions();
        final var context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep);
        final var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
        return MaxEffortEnvelope.from(context, schedule.initialSpeed, maxSpeedEnvelope);
    }

    private static Envelope applyAllowances(
            Envelope maxEffortEnvelope,
            StandaloneTrainSchedule schedule
    ) {
        var result = maxEffortEnvelope;
        for (int i = 0; i < schedule.allowances.size(); i++) {
            try {
                result = schedule.allowances.get(i).apply(result);
            } catch (OSRDError e) {
                throw e.withContext(new ErrorContext.Allowance(i));
            }
        }
        return result;
    }
}
