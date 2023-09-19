package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.sim_infra.api.TrackInfraKt.getTrackSectionFromNameOrThrow;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.units.Distance.fromMeters;

import com.google.common.collect.Iterables;
import fr.sncf.osrd.DriverBehaviour;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.kt_external_generated_inputs.ElectricalProfileMapping;
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.reporting.ErrorContext;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.PathKt;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra.api.TrackChunk;
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange;
import fr.sncf.osrd.standalone_sim.result.PowerRestrictionRange;
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.ScheduledPoint;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.Direction;
import fr.sncf.osrd.utils.indexing.DirStaticIdxKt;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;
import java.util.*;

public class StandaloneSim {
    /**
     * Runs a batch of standalone simulations for multiple trains.
     * Interactions between trains are ignored.
     */
    public static StandaloneSimResult run(
            FullInfra infra,
            Path trainPath,
            EnvelopeSimPath envelopeSimPath,
            List<StandaloneTrainSchedule> schedules,
            double timeStep,
            DriverBehaviour driverBehaviour
    ) {
        // Compute envelopes
        var result = new StandaloneSimResult();
        var cacheSpeedLimits = new HashMap<StandaloneTrainSchedule, List<ResultEnvelopePoint>>();
        var cacheMaxEffort = new HashMap<StandaloneTrainSchedule, ResultTrain>();
        var cacheEco = new HashMap<StandaloneTrainSchedule, ResultTrain>();
        var cacheElectrificationRanges = new HashMap<StandaloneTrainSchedule, List<ElectrificationRange>>();
        var cachePowerRestrictionRanges = new HashMap<StandaloneTrainSchedule, List<PowerRestrictionRange>>();
        for (var trainSchedule : schedules) {
            if (!cacheMaxEffort.containsKey(trainSchedule)) {
                var rollingStock = trainSchedule.rollingStock;

                // MRSP & SpeedLimits
                var mrsp = MRSP.computeMRSP(trainPath, rollingStock, true, trainSchedule.tag);
                var speedLimits = MRSP.computeMRSP(trainPath, rollingStock, false, trainSchedule.tag);
                mrsp = driverBehaviour.applyToMRSP(mrsp);
                cacheSpeedLimits.put(trainSchedule, ResultEnvelopePoint.from(speedLimits));

                // Context
                var electrificationMap = envelopeSimPath.getElectrificationMap(rollingStock.basePowerClass,
                        trainSchedule.powerRestrictionMap, rollingStock.powerRestrictions,
                        trainSchedule.options.ignoreElectricalProfiles);

                var curvesAndConditions =
                        rollingStock.mapTractiveEffortCurves(electrificationMap, trainSchedule.comfort);
                var context = new EnvelopeSimContext(rollingStock, envelopeSimPath, timeStep,
                        curvesAndConditions.curves());
                cacheElectrificationRanges.put(trainSchedule, ElectrificationRange.from(
                        curvesAndConditions.conditions(), electrificationMap));
                cachePowerRestrictionRanges.put(trainSchedule, PowerRestrictionRange.from(
                        curvesAndConditions.conditions(), trainSchedule.powerRestrictionMap));

                // MaxSpeedEnvelope
                var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, trainSchedule.getStopsPositions(), mrsp);

                // MaxEffortEnvelope
                // need to compute a new effort curve mapping with the maxSpeedEnvelope in order to extend the
                // neutral sections (with time to lower/raise pantograph...)
                context = context.updateCurves(
                        rollingStock.addNeutralSystemTimes(electrificationMap, trainSchedule.comfort, maxSpeedEnvelope,
                                context.tractiveEffortCurveMap));
                var envelope = MaxEffortEnvelope.from(context, trainSchedule.initialSpeed, maxSpeedEnvelope);

                var simResultTrain = ScheduleMetadataExtractor.run(
                        envelope,
                        trainPath,
                        trainSchedule,
                        infra
                );
                cacheMaxEffort.put(trainSchedule, simResultTrain);

                // Eco: Integrate allowances and scheduled points
                if (!trainSchedule.allowances.isEmpty() || !trainSchedule.scheduledPoints.isEmpty()) {
                    var ecoEnvelope = applyAllowances(context, envelope, trainSchedule.allowances);
                    ecoEnvelope = applyScheduledPoints(
                            context, ecoEnvelope, trainSchedule.stops, trainSchedule.scheduledPoints);
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
            result.electrificationRanges.add(cacheElectrificationRanges.get(trainSchedule));
            result.powerRestrictionRanges.add(cachePowerRestrictionRanges.get(trainSchedule));
        }
        return result;
    }

    /** Parse some railJSON arguments and run a standalone simulation */
    public static StandaloneSimResult runFromRJS(
            FullInfra infra,
            ElectricalProfileMapping electricalProfileMap,
            RJSTrainPath rjsTrainPath,
            HashMap<String, RollingStock> rollingStocks,
            List<RJSStandaloneTrainSchedule> rjsSchedules,
            double timeStep
    ) {
        // Parse trainPath
        var trainPath = makeTrainPath(infra.rawInfra(), rjsTrainPath);
        var envelopePath = EnvelopeTrainPath.from(trainPath, electricalProfileMap);

        // Parse train schedules
        var trainSchedules = new ArrayList<StandaloneTrainSchedule>();
        for (var rjsTrainSchedule : rjsSchedules)
            trainSchedules.add(RJSStandaloneTrainScheduleParser.parse(
                    infra, rollingStocks::get, rjsTrainSchedule, trainPath, envelopePath));

        // Compute envelopes and extract metadata
        return StandaloneSim.run(
                infra,
                trainPath,
                envelopePath,
                trainSchedules,
                timeStep,
                new DriverBehaviour()
        );
    }

    /** Builds a Path from an RJSTrainPath*/
    public static Path makeTrainPath(RawSignalingInfra infra, RJSTrainPath rjsPath) {
        var trackRanges = new ArrayList<RJSDirectionalTrackRange>();
        for (var routePath : rjsPath.routePath) {
            for (var trackRange : routePath.trackSections) {
                var last = Iterables.getLast(trackRanges, null);
                if (last != null && last.trackSectionID.equals(trackRange.trackSectionID)) {
                    assert last.getEnd() == trackRange.getBegin();
                    assert last.direction == trackRange.direction;
                    if (trackRange.direction == EdgeDirection.START_TO_STOP)
                        last.end = trackRange.end;
                    else
                        last.begin = trackRange.begin;
                } else {
                    trackRanges.add(trackRange);
                }
            }
        }
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        for (var trackRange : trackRanges) {
            var trackId = getTrackSectionFromNameOrThrow(trackRange.trackSectionID, infra);
            var dir = trackRange.direction == EdgeDirection.START_TO_STOP ? Direction.INCREASING : Direction.DECREASING;
            var chunksOnTrack = toIntList(infra.getTrackSectionChunks(trackId));
            if (dir == Direction.DECREASING)
                Collections.reverse(chunksOnTrack);
            for (var chunk : chunksOnTrack)
                chunks.add(DirStaticIdxKt.from(chunk, dir));
        }
        var startOffset = fromMeters(trackRanges.get(0).begin);
        var endOffset = startOffset + fromMeters(
                trackRanges.stream()
                        .mapToDouble(r -> r.end - r.begin)
                        .sum()
        );
        return PathKt.buildPathFrom(infra, chunks, startOffset, endOffset);
    }

    /**
     * Apply a list of allowances, in order
     */
    public static Envelope applyAllowances(
            EnvelopeSimContext context,
            Envelope maxEffortEnvelope,
            List<? extends Allowance> allowances
    ) {
        var result = maxEffortEnvelope;
        for (int i = 0; i < allowances.size(); i++) {
            try {
                result = allowances.get(i).apply(result, context);
            } catch (OSRDError e) {
                throw e.withStackTrace(new ErrorContext.Allowance(i));
            }
        }
        return result;
    }

    /**  Generate a mareco Allowance given a list of scheduled points.
     *   Return an empty value:
     *   - if no scheduled point is given
     *   - if we cannot respect any scheduled points. */
    public static Optional<MarecoAllowance> generateAllowanceFromScheduledPoints(
            EnvelopeStopWrapper maxEffortEnvelope,
            List<ScheduledPoint> scheduledPoints
    ) {
        scheduledPoints.sort(Comparator.comparingDouble(sp -> sp.pathOffset));
        var ranges = new ArrayList<AllowanceRange>();
        double rangeBeginPos = 0.;
        double lostTime = 0.;
        for (var schedulePoint : scheduledPoints) {
            var rangeEndPos = schedulePoint.pathOffset;
            double excessTime = schedulePoint.time - maxEffortEnvelope.interpolateTotalTime(rangeEndPos) - lostTime;
            if (excessTime < 0) {
                // TODO: Raise a warning
                continue;
            }
            ranges.add(new AllowanceRange(rangeBeginPos, rangeEndPos, new AllowanceValue.FixedTime(excessTime)));
            rangeBeginPos = rangeEndPos;
            lostTime += excessTime;
        }

        // If no ranges
        if (ranges.isEmpty())
            return Optional.empty();

        // Set minimum capacity limit
        double capacityLimit = 1.0;
        return Optional.of(new MarecoAllowance(0., rangeBeginPos, capacityLimit, ranges));
    }

    /**  Apply a list of scheduled points */
    public static Envelope applyScheduledPoints(
            EnvelopeSimContext context,
            Envelope maxEffortEnvelope,
            List<TrainStop> stops,
            List<ScheduledPoint> scheduledPoints
    ) {
        var envelopeStopWrapper = new EnvelopeStopWrapper(maxEffortEnvelope, stops);
        var allowance = generateAllowanceFromScheduledPoints(envelopeStopWrapper, scheduledPoints);
        if (allowance.isEmpty())
            return maxEffortEnvelope;
        return applyAllowances(context, maxEffortEnvelope, List.of(allowance.get()));
    }
}
