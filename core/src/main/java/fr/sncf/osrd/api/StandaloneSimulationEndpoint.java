package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.InfraManager.InfraLoadException;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeDebug;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.*;
import fr.sncf.osrd.utils.CurveSimplification;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.io.IOException;
import java.util.*;

public class StandaloneSimulationEndpoint implements Take {
    private final InfraManager infraManager;

    public static final JsonAdapter<StandaloneSimulationRequest> adapterRequest = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .build()
            .adapter(StandaloneSimulationRequest.class);

    public static final JsonAdapter<StandaloneSimulationResult> adapterResult = new Moshi
            .Builder()
            .build()
            .adapter(StandaloneSimulationResult.class);

    public StandaloneSimulationEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    @Override
    public Response act(Request req) throws
            IOException,
            InvalidRollingStock,
            InvalidSchedule,
            InvalidSuccession,
            SimulationError {
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            // load infra
            Infra infra;
            try {
                infra = infraManager.load(request.infra);
            } catch (InfraLoadException | InterruptedException e) {
                return new RsWithStatus(new RsText(
                        String.format("Error loading infrastructure '%s'%n%s", request.infra, e.getMessage())), 400);
            }

            // Parse rolling stocks
            var rollingStocks = new HashMap<String, RollingStock>();
            for (var rjsRollingStock : request.rollingStocks)
                rollingStocks.put(rjsRollingStock.id, RJSRollingStockParser.parse(rjsRollingStock));

            // Parse trainsPath
            var trainsPath = TrainPath.from(infra, request.trainsPath);

            // Compute envelopes
            var result = new StandaloneSimulationResult();
            var cache = new HashMap<StandaloneTrainSchedule, SimulationResultTrain>();
            for (var rjsTrainSchedule : request.trainSchedules) {
                var trainSchedule = RJSStandaloneTrainScheduleParser.parse(
                        infra, rollingStocks::get, rjsTrainSchedule, trainsPath);

                if (!cache.containsKey(trainSchedule)) {
                    var envelope = computeEnvelope(trainsPath, trainSchedule);
                    var simResultTrain = SimulationResultTrain.from(envelope, trainsPath, trainSchedule);
                    cache.put(trainSchedule, simResultTrain);
                }

                result.trains.put(rjsTrainSchedule.id, cache.get(trainSchedule));
            }

            return new RsJson(new RsWithBody(adapterResult.toJson(result)));
        } catch (Throwable ex) {
            ex.printStackTrace(System.err);
            throw ex;
        }
    }

    private static Envelope computeEnvelope(TrainPath trainsPath, StandaloneTrainSchedule schedule) {
        var rollingStock = schedule.rollingStock;
        var mrsp = MRSP.from(trainsPath, rollingStock);
        var infraPathGrade = EnvelopeTrainPath.from(trainsPath);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(rollingStock, infraPathGrade, schedule.stops, mrsp);
        return MaxEffortEnvelope.from(rollingStock, infraPathGrade, schedule.initialSpeed, maxSpeedEnvelope);
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static final class StandaloneSimulationRequest {
        /** Infra id */
        public final String infra;

        /** A list of rolling stocks involved in this simulation */
        @Json(name = "rolling_stocks")
        public List<RJSRollingStock> rollingStocks;

        /** A list of trains plannings */
        @Json(name = "train_schedules")
        public List<RJSStandaloneTrainSchedule> trainSchedules;

        /** The path used by trains */
        @Json(name = "trains_path")
        public RJSTrainPath trainsPath;

        /** Create SimulationRequest */
        public StandaloneSimulationRequest(
                String infra,
                List<RJSRollingStock> rollingStocks,
                List<RJSStandaloneTrainSchedule> trainSchedules,
                RJSTrainPath trainsPath
        ) {
            this.infra = infra;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
            this.trainsPath = trainsPath;
        }
    }


    @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
    private static ArrayList<SimulationResultPosition> simplifyPositions(
            ArrayList<SimulationResultPosition> positions) {
        return CurveSimplification.rdp(
                positions,
                5.,
                (point, start, end) -> {
                    if (Math.abs(start.time - end.time) < 0.000001)
                        return Math.abs(point.pathOffset - start.pathOffset);
                    var proj = start.pathOffset + (point.time - start.time)
                            * (end.pathOffset - start.pathOffset) / (end.time - start.time);
                    return Math.abs(point.pathOffset - proj);
                }
        );
    }

    @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
    private static ArrayList<SimulationResultSpeed> simplifySpeeds(
            ArrayList<SimulationResultSpeed> speeds) {
        return CurveSimplification.rdp(
                speeds,
                0.2,
                (point, start, end) -> {
                    if (Math.abs(start.position - end.position) < 0.000001)
                        return Math.abs(point.speed - start.speed);
                    var proj = start.speed + (point.position - start.position)
                            * (end.speed - start.speed) / (end.position - start.position);
                    return Math.abs(point.speed - proj);
                }
        );
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class StandaloneSimulationResult {
        public Map<String, SimulationResultTrain> trains = new HashMap<>();
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultTrain {
        public Collection<SimulationResultSpeed> speeds = new ArrayList<>();
        @Json(name = "head_positions")
        public Collection<SimulationResultPosition> headPositions = new ArrayList<>();
        @Json(name = "tail_positions")
        public Collection<SimulationResultPosition> tailPositions = new ArrayList<>();
        @Json(name = "stop_reaches")
        public Collection<SimulationResultStopReach> stopReaches = new ArrayList<>();

        static SimulationResultTrain from(
                Envelope envelope,
                TrainPath trainPath,
                StandaloneTrainSchedule schedule
        ) {
            assert envelope.continuous;
            var result = new SimulationResultTrain();
            var length = schedule.rollingStock.length;
            double time = 0;
            for (var part : envelope) {
                for (int i = 0; i < part.pointCount(); i++) {
                    var pos = part.getPointPos(i);
                    var speed = part.getPointSpeed(i);
                    result.speeds.add(new SimulationResultSpeed(time, speed, pos));
                    result.headPositions.add(new SimulationResultPosition(time, pos, trainPath));
                    var tailPos = Math.max(pos - length, 0);
                    result.headPositions.add(new SimulationResultPosition(time, tailPos, trainPath));
                    if (i < part.stepCount())
                        time += part.getStepTime(i);
                }
            }

            for (var stop : schedule.stops) {
                var stopTime = envelope.interpolateTotalTime(stop.position);
                result.stopReaches.add(new SimulationResultStopReach(stopTime, stop.position));
            }

            result.simplify();
            return result;
        }

        @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
        private void simplify() {
            this.speeds = simplifySpeeds((ArrayList<SimulationResultSpeed>) speeds);
            this.headPositions = simplifyPositions((ArrayList<SimulationResultPosition>) headPositions);
            this.tailPositions = simplifyPositions((ArrayList<SimulationResultPosition>) tailPositions);
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultSpeed {
        public final double time;
        public final double position;
        public final double speed;

        SimulationResultSpeed(double time, double speed, double position) {
            this.time = time;
            this.speed = speed;
            this.position = position;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultPosition {
        public final double time;
        @Json(name = "track_section")
        public final String trackSection;
        public final double offset;
        @Json(name = "path_offset")
        public final double pathOffset;

        SimulationResultPosition(double time, double pathOffset, TrainPath trainPath) {
            this.time = time;
            this.pathOffset = pathOffset;
            var location = trainPath.findLocation(pathOffset);
            this.trackSection = location.edge.id;
            this.offset = location.offset;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultStopReach {
        public final double time;
        public final double position;

        SimulationResultStopReach(double time, double position) {
            this.time = time;
            this.position = position;
        }
    }
}

