package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.StopActionPoint.RestartTrainEvent.RestartTrainPlanned;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.api.InfraManager.InfraLoadException;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.railjson.schema.successiontable.RJSTrainSuccessionTable;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
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

public class SimulationEndpoint implements Take {
    private final InfraManager infraManager;

    public static final JsonAdapter<SimulationRequest> adapterRequest = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSTrainPhase.adapter)
            .add(RJSAllowance.adapter)
            .build()
            .adapter(SimulationRequest.class);

    public static final JsonAdapter<SimulationResult> adapterResult = new Moshi
            .Builder()
            .build()
            .adapter(SimulationResult.class);

    public SimulationEndpoint(InfraManager infraManager) {
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

            // load train schedules
            var rjsSimulation = new RJSSimulation(request.rollingStocks, request.trainSchedules, request.trainSuccessionTables);
            var trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation);
            var trainSuccessionTables = RJSSimulationParser.parseTrainSuccessionTables(rjsSimulation);

            // create the simulation and his changelog
            var changeConsumers = new ArrayList<ChangeConsumer>();
            var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
            var sim = Simulation.createFromInfraAndSuccessions(infra, trainSuccessionTables, 0, multiplexer);
            var resultLog = new ArrayResultLog(infra, sim);
            multiplexer.add(resultLog);

            // insert the train start events into the simulation
            for (var trainSchedule : trainSchedules)
                TrainCreatedEvent.plan(sim, trainSchedule);

            // run the simulation loop
            while (!sim.isSimulationOver())
                sim.step();

            // Check number of reached stops is what we expect
            resultLog.validate();

            // Simplify data
            resultLog.simplify();

            return new RsJson(new RsWithBody(adapterResult.toJson(resultLog.result)));
        } catch (Throwable ex) {
            ex.printStackTrace(System.err);
            throw ex;
        }
    }



    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static final class SimulationRequest {
        /** Infra id */
        public final String infra;

        /** A list of rolling stocks involved in this simulation */
        @Json(name = "rolling_stocks")
        public List<RJSRollingStock> rollingStocks;

        /** A list of trains plannings */
        @Json(name = "train_schedules")
        public List<RJSTrainSchedule> trainSchedules;

        /** A list of trains successions tables */
        @Json(name = "train_succession_tables")
        public List<RJSTrainSuccessionTable> trainSuccessionTables;

        /** Create SimulationRequest */
        public SimulationRequest(
                String infra,
                List<RJSRollingStock> rollingStocks,
                List<RJSTrainSchedule> trainSchedules,
                List<RJSTrainSuccessionTable> trainSuccessionTables
        ) {
            this.infra = infra;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
            this.trainSuccessionTables = trainSuccessionTables;
        }

        /** Create SimulationRequest with empty successions tables */
        public SimulationRequest(
                String infra,
                List<RJSRollingStock> rollingStocks,
                List<RJSTrainSchedule> trainSchedules
        ) {
            this.infra = infra;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
            this.trainSuccessionTables = null;
        }
    }


    private static final class ArrayResultLog extends ChangeConsumer {
        public final SimulationResult result = new SimulationResult();
        public final Infra infra;
        public final HashMap<String, TrainSchedule> trainSchedules = new HashMap<>();
        public final Simulation sim;

        public ArrayResultLog(Infra infra, Simulation sim) {
            this.infra = infra;
            this.sim = sim;
        }

        public SimulationResultTrain getTrainResult(String trainId) {
            var trainResult = result.trains.get(trainId);
            if (trainResult == null) {
                trainResult = new SimulationResultTrain();
                result.trains.put(trainId, trainResult);
            }
            return trainResult;
        }

        public void validate() throws SimulationError {
            for (var trainName : result.trains.keySet()) {
                var trainResult = result.trains.get(trainName);
                var nStopReached = trainResult.stopReaches.size();
                var trainSchedule = trainSchedules.get(trainName);
                var expectedStopReached = trainSchedule.stops.size();
                if (nStopReached != expectedStopReached) {
                    var err = String.format("Train '%s', unexpected stop number: expected %d, got %d",
                            trainName, expectedStopReached, nStopReached);
                    throw new SimulationError(err);
                }
            }
        }

        @Override
        public void changeCreationCallback(Change change) { }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public void changePublishedCallback(Change change) {
            if (change.getClass() == RouteState.RouteStatusChange.class) {
                var routeStatusChange = (RouteState.RouteStatusChange) change;
                var route = infra.routeGraph.getEdge(routeStatusChange.routeIndex);
                var newStatus = routeStatusChange.newStatus;
                result.routesStatus.add(new SimulationResultRouteStatus(sim.getTime(), route, newStatus));
            } else if (change.getClass() == Train.TrainStateChange.class) {
                var trainStateChange = (Train.TrainStateChange) change;
                var trainResult = getTrainResult(trainStateChange.trainID);
                var train = trainSchedules.get(trainStateChange.trainID);
                for (var pos : trainStateChange.positionUpdates) {
                    trainResult.headPositions.add(new SimulationResultPosition(pos.time, pos.pathPosition, train));
                    var tailPathPosition = Math.max(0, pos.pathPosition - train.rollingStock.length);
                    trainResult.tailPositions.add(new SimulationResultPosition(pos.time, tailPathPosition, train));
                    trainResult.speeds.add(new SimulationResultSpeed(pos.time, pos.speed, pos.pathPosition));
                }
            } else if (change.getClass() == TrainCreatedEvent.TrainPlannedCreation.class) {
                // Cache train schedule
                var trainCreationPlanned = (TrainCreatedEvent.TrainPlannedCreation) change;
                trainSchedules.put(trainCreationPlanned.schedule.trainID, trainCreationPlanned.schedule);
                // Initial position and speed
                var train = trainCreationPlanned.schedule;
                var trainResult = getTrainResult(train.trainID);
                var creationTime = trainCreationPlanned.eventId.scheduledTime;
                trainResult.headPositions.add(new SimulationResultPosition(creationTime, 0, train));
                trainResult.tailPositions.add(new SimulationResultPosition(creationTime, 0, train));
                trainResult.speeds.add(new SimulationResultSpeed(creationTime, train.initialSpeed, 0));
            } else if (change.getClass() == SignalState.SignalAspectChange.class) {
                var aspectChange = (SignalState.SignalAspectChange) change;
                var signal = infra.signals.get(aspectChange.signalIndex).id;
                var aspects = new ArrayList<String>();
                for (var aspect : aspectChange.aspects)
                    aspects.add(aspect.id);
                result.signalChanges.add(new SimulationResultSignalChange(sim.getTime(), signal, aspects));
            } else if (change.getClass() == RestartTrainPlanned.class) {
                var stopReached = (RestartTrainPlanned) change;
                var trainResult = getTrainResult(stopReached.train.getID());
                var stopIndex = stopReached.stopIndex;
                var stopPosition = stopReached.train.schedule.stops.get(stopIndex).position;
                trainResult.stopReaches.add(new SimulationResultStopReach(sim.getTime(), stopIndex, stopPosition));
            }
        }

        private ArrayList<SimulationResultPosition> simplifyPositions(
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

        public void simplify() {
            for (var train : result.trains.values()) {
                train.headPositions = simplifyPositions((ArrayList<SimulationResultPosition>) train.headPositions);
                train.tailPositions = simplifyPositions((ArrayList<SimulationResultPosition>) train.tailPositions);

                var speeds = (ArrayList<SimulationResultSpeed>) train.speeds;
                train.speeds = CurveSimplification.rdp(
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
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResult {
        public Map<String, SimulationResultTrain> trains = new HashMap<>();
        @Json(name = "routes_status")
        public Collection<SimulationResultRouteStatus> routesStatus = new ArrayList<>();
        @Json(name = "signal_changes")
        public Collection<SimulationResultSignalChange> signalChanges = new ArrayList<>();
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

        SimulationResultPosition(double time, double pathOffset, TrainSchedule trainSchedule) {
            this.time = time;
            this.pathOffset = pathOffset;
            var location = trainSchedule.plannedPath.findLocation(pathOffset);
            this.trackSection = location.edge.id;
            this.offset = location.offset;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultRouteStatus {
        public final double time;
        @Json(name = "route_id")
        public final String routeId;
        public final RouteStatus status;
        @Json(name = "start_track_section")
        public final String startTrackSection;
        @Json(name = "start_offset")
        public final double startOffset;
        @Json(name = "end_track_section")
        public final String endTrackSection;
        @Json(name = "end_offset")
        public final double endOffset;

        SimulationResultRouteStatus(double time, Route route, RouteStatus status) {
            this.time = time;
            this.routeId = route.id;
            this.status = status;
            var start = route.tvdSectionsPaths.get(0).trackSections[0];
            this.startTrackSection = start.edge.id;
            this.startOffset = start.getBeginPosition();
            var lastIndex = route.tvdSectionsPaths.size() - 1;
            var lastTracks = route.tvdSectionsPaths.get(lastIndex).trackSections;
            var end = lastTracks[lastTracks.length - 1];
            this.endTrackSection = end.edge.id;
            this.endOffset = end.getEndPosition();
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultSignalChange {
        public final double time;
        @Json(name = "signal_id")
        public final String signalId;
        public final List<String> aspects;

        SimulationResultSignalChange(double time, String signalId, List<String> aspects) {
            this.time = time;
            this.signalId = signalId;
            this.aspects = aspects;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SimulationResultStopReach {
        public final double time;
        @Json(name = "stop_index")
        public final int stopIndex;
        public final double position;

        SimulationResultStopReach(double time, int stopIndex, double position) {
            this.time = time;
            this.stopIndex = stopIndex;
            this.position = position;
        }
    }
}

