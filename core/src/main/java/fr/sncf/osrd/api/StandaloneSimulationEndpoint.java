package fr.sncf.osrd.api;

import static fr.sncf.osrd.api.StandaloneSimulationEndpoint.SimulationResultPosition.interpolateTime;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.exceptions.OSRDError;
import fr.sncf.osrd.exceptions.ErrorContext;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.*;
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
            .add(RJSAllowance.adapter)
            .add(RJSAllowanceValue.adapter)
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
            InvalidInfraException {
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            // load infra
            var infra = infraManager.load(request.infra);

            // Parse rolling stocks
            var rollingStocks = new HashMap<String, RollingStock>();
            for (var rjsRollingStock : request.rollingStocks)
                rollingStocks.put(rjsRollingStock.id, RJSRollingStockParser.parse(rjsRollingStock));

            // Parse trainsPath
            var trainsPath = TrainPath.from(infra, request.trainsPath);
            var envelopePath = EnvelopeTrainPath.from(trainsPath);

            // Compute envelopes
            var result = new StandaloneSimulationResult();
            var cacheMRSP = new HashMap<StandaloneTrainSchedule, List<MRSPPointResult>>();
            var cacheMaxEffort = new HashMap<StandaloneTrainSchedule, SimulationResultTrain>();
            var cacheEco = new HashMap<StandaloneTrainSchedule, SimulationResultTrain>();
            for (var rjsTrainSchedule : request.trainSchedules) {
                var trainSchedule = RJSStandaloneTrainScheduleParser.parse(
                        infra, request.timeStep, rollingStocks::get, rjsTrainSchedule, trainsPath, envelopePath);

                if (!cacheMaxEffort.containsKey(trainSchedule)) {
                    // MRSP
                    var mrsp = MRSP.from(trainsPath, trainSchedule.rollingStock);
                    cacheMRSP.put(trainSchedule, MRSPPointResult.from(mrsp));

                    // Base
                    var envelope = computeMaxEffortEnvelope(mrsp, request.timeStep, envelopePath, trainSchedule);
                    var simResultTrain = SimulationResultTrain.from(
                            envelope,
                            trainsPath,
                            request.trainsPath,
                            trainSchedule,
                            infra);
                    cacheMaxEffort.put(trainSchedule, simResultTrain);

                    // Eco
                    if (!trainSchedule.allowances.isEmpty()) {
                        var ecoEnvelope = applyAllowances(envelope, trainSchedule);
                        var simEcoResultTrain = SimulationResultTrain.from(
                                ecoEnvelope,
                                trainsPath,
                                request.trainsPath,
                                trainSchedule,
                                infra);
                        cacheEco.put(trainSchedule, simEcoResultTrain);
                    }
                }

                result.mrsps.add(cacheMRSP.get(trainSchedule));
                result.baseSimulations.add(cacheMaxEffort.get(trainSchedule));
                result.ecoSimulations.add(cacheEco.getOrDefault(trainSchedule, null));
            }

            return new RsJson(new RsWithBody(adapterResult.toJson(result)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
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

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static final class StandaloneSimulationRequest {
        /** Infra id */
        public String infra;

        /** The time step which shall be used for all simulations */
        @Json(name = "time_step")
        public double timeStep;

        /** A list of rolling stocks involved in this simulation */
        @Json(name = "rolling_stocks")
        public List<RJSRollingStock> rollingStocks;

        /** A list of trains plannings */
        @Json(name = "train_schedules")
        public List<RJSStandaloneTrainSchedule> trainSchedules;

        /** The path used by trains */
        @Json(name = "trains_path")
        public RJSTrainPath trainsPath;

        /** Create a default SimulationRequest */
        public StandaloneSimulationRequest() {
            infra = null;
            timeStep = 2.0;
            rollingStocks = null;
            trainSchedules = null;
            trainsPath = null;
        }

        /** Create SimulationRequest */
        public StandaloneSimulationRequest(
                String infra,
                double timeStep,
                List<RJSRollingStock> rollingStocks,
                List<RJSStandaloneTrainSchedule> trainSchedules,
                RJSTrainPath trainsPath
        ) {
            this.infra = infra;
            this.timeStep = timeStep;
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
    private static ArrayList<SimulationResultSpeed> simplifySpeeds(ArrayList<SimulationResultSpeed> speeds) {
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
        @Json(name = "base_simulations")
        public List<SimulationResultTrain> baseSimulations = new ArrayList<>();
        @Json(name = "eco_simulations")
        public List<SimulationResultTrain> ecoSimulations = new ArrayList<>();
        public List<List<MRSPPointResult>> mrsps = new ArrayList<>();
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultTrain {
        public final List<SimulationResultSpeed> speeds;
        @Json(name = "head_positions")
        public final List<SimulationResultPosition> headPositions;
        public final List<SimulationResultStops> stops;
        @Json(name = "route_occupancies")
        public final Map<String, SimulationResultRouteOccupancy> routeOccupancies;

        SimulationResultTrain(
                List<SimulationResultSpeed> speeds,
                List<SimulationResultPosition> headPositions,
                List<SimulationResultStops> stops, Map<String,
                SimulationResultRouteOccupancy> routeOccupancies
        ) {
            this.speeds = speeds;
            this.headPositions = headPositions;
            this.stops = stops;
            this.routeOccupancies = routeOccupancies;
        }

        static SimulationResultTrain from(
                Envelope envelope,
                TrainPath trainPath,
                RJSTrainPath rjsTrainPath,
                StandaloneTrainSchedule schedule,
                Infra infra
        ) throws InvalidInfraException {
            assert envelope.continuous;
            // Compute speeds, head and tail positions
            var trainLength = schedule.rollingStock.length;
            var speeds = new ArrayList<SimulationResultSpeed>();
            var headPositions = new ArrayList<SimulationResultPosition>();
            double time = 0;
            for (var part : envelope) {
                // Add head position points
                for (int i = 0; i < part.pointCount(); i++) {
                    var pos = part.getPointPos(i);
                    var speed = part.getPointSpeed(i);
                    speeds.add(new SimulationResultSpeed(time, speed, pos));
                    headPositions.add(new SimulationResultPosition(time, pos, trainPath));
                    if (i < part.stepCount())
                        time += part.getStepTime(i);
                }

                if (part.getEndSpeed() > 0)
                    continue;

                // Add stop duration
                for (var stop : schedule.stops) {
                    if (stop.duration == 0. || stop.position < part.getEndPos())
                        continue;
                    if (stop.position > part.getEndPos())
                        break;
                    time += stop.duration;
                    headPositions.add(new SimulationResultPosition(time, part.getEndPos(), trainPath));
                }
            }

            // Simplify data
            speeds = simplifySpeeds(speeds);
            headPositions = simplifyPositions(headPositions);

            // Compute stops
            var stops = new ArrayList<SimulationResultStops>();
            for (var stop : schedule.stops) {
                var stopTime = interpolateTime(stop.position, headPositions);
                stops.add(new SimulationResultStops(stopTime, stop.position, stop.duration));
            }

            // Compute routeOccupancy
            var routeOccupancies = new HashMap<String, SimulationResultRouteOccupancy>();
            double lastPosition = 0;
            for (var routePath : rjsTrainPath.routePath) {
                var route = routePath.route.getRoute(infra.routeGraph.routeMap);
                var conflictedRoutes = route.getConflictedRoutes();
                var newPosition = lastPosition;
                for (var trackRange : routePath.trackSections)
                    newPosition += Math.abs(trackRange.end - trackRange.begin);
                var routeOccupancy =
                        SimulationResultRouteOccupancy.from(lastPosition, newPosition, headPositions, trainLength);

                for (var conflictedRoute : conflictedRoutes) {
                    if (!routeOccupancies.containsKey(conflictedRoute.id)) {
                        routeOccupancies.put(conflictedRoute.id, routeOccupancy);
                        continue;
                    }
                    var oldOccupancy = routeOccupancies.get(conflictedRoute.id);
                    var newOccupancy = new SimulationResultRouteOccupancy(
                            oldOccupancy.timeHeadOccupy,
                            routeOccupancy.timeHeadFree,
                            oldOccupancy.timeTailOccupy,
                            routeOccupancy.timeTailFree);
                    routeOccupancies.replace(conflictedRoute.id, newOccupancy);
                }
                lastPosition = newPosition;
            }
            return new SimulationResultTrain(speeds, headPositions, stops, routeOccupancies);
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

        /** Interpolate in a list of positions the time associated to a given position.
         * Note: Using envelope is not possible since the stop duration is not taken into account in envelopes.
         * @param position between 0 and last position
         * @param headPositions list of positions
         */
        public static double interpolateTime(double position, ArrayList<SimulationResultPosition> headPositions) {
            int leftIndex = 0;
            int rightIndex = headPositions.size() - 1;
            assert position >= 0;
            assert position <= headPositions.get(rightIndex).pathOffset;
            // Binary search to find the interval to use for interpolation
            while (rightIndex - leftIndex > 1) {
                int median = (rightIndex + leftIndex) / 2;
                if (position > headPositions.get(median).pathOffset)
                    leftIndex = median;
                else
                    rightIndex = median;
            }

            var a = headPositions.get(leftIndex);
            var b = headPositions.get(rightIndex);
            return a.time + (position - a.pathOffset) * (b.time - a.time) / (b.pathOffset - a.pathOffset);
        }

    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultStops {
        public final double time;
        public final double position;
        public final double duration;

        SimulationResultStops(double time, double position, double duration) {
            this.time = time;
            this.position = position;
            this.duration = duration;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultRouteOccupancy {
        @Json(name = "time_head_occupy")
        public final double timeHeadOccupy;
        @Json(name = "time_head_free")
        public final double timeHeadFree;
        @Json(name = "time_tail_occupy")
        public final double timeTailOccupy;
        @Json(name = "time_tail_free")
        public final double timeTailFree;

        SimulationResultRouteOccupancy(
                double timeHeadOccupy,
                double timeHeadFree,
                double timeTailOccupy,
                double timeTailFree
        ) {
            this.timeHeadOccupy = timeHeadOccupy;
            this.timeHeadFree = timeHeadFree;
            this.timeTailOccupy = timeTailOccupy;
            this.timeTailFree = timeTailFree;
        }

        static SimulationResultRouteOccupancy from(
                double startPosition,
                double endPosition,
                ArrayList<SimulationResultPosition> headPositions,
                double trainLength
        ) {
            var timeHeadFree = interpolateTime(endPosition, headPositions);
            var timeHeadOccupy = interpolateTime(startPosition, headPositions);
            var pathLength = headPositions.get(headPositions.size() - 1).pathOffset;
            var timeTailFree = interpolateTime(Math.min(pathLength, endPosition + trainLength), headPositions);
            double timeTailOccupy = 0;
            // Special case for first route
            if (startPosition > 0)
                timeTailOccupy = interpolateTime(Math.min(pathLength, startPosition + trainLength), headPositions);
            return new SimulationResultRouteOccupancy(timeHeadOccupy, timeHeadFree, timeTailOccupy, timeTailFree);
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    private static class MRSPPointResult {
        public final double position;
        public final double speed;

        public MRSPPointResult(double position, double speed) {
            this.position = position;
            this.speed = speed;
        }

        public static List<MRSPPointResult> from(Envelope mrsp) {
            var res = new ArrayList<MRSPPointResult>();
            for (var mrspPart : mrsp) {
                for (int i = 0; i < mrspPart.pointCount(); i++)
                    res.add(new MRSPPointResult(mrspPart.getPointPos(i), mrspPart.getPointSpeed(i)));
            }
            return res;
        }
    }
}

