package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.StopActionPoint.StopReachedChange;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.SuccessionTable;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.RJSSuccessionsParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.RJSSuccessions;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.railjson.schema.successiontable.RJSSuccessionTable;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
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
    private final InfraHandler infraHandler;

    public static final JsonAdapter<SimulationRequest> adapterRequest = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSTrainPhase.adapter)
            .add(RJSAllowance.adapter)
            .build()
            .adapter(SimulationRequest.class);

    public static final JsonAdapter<SimulationResultChange[]> adapterResult = new Moshi
            .Builder()
            .add(SimulationResultChange.adapter)
            .build()
            .adapter(SimulationResultChange[].class);

    public SimulationEndpoint(InfraHandler infraHandler) {
        this.infraHandler = infraHandler;
    }

    @Override
    public Response act(Request req) throws IOException, InvalidRollingStock, InvalidSchedule, InvalidSuccession, SimulationError {
        // Parse request input
        var body = new RqPrint(req).printBody();
        var request = adapterRequest.fromJson(body);
        if (request == null)
            return new RsWithStatus(new RsText("missing request body"), 400);

        // load infra
        Infra infra;
        try {
            infra = infraHandler.load(request.infra);
        } catch (InvalidInfraException | IOException e) {
            return new RsWithStatus(new RsText(
                    String.format("Error loading infrastructure '%s'%n%s", request.infra, e.getMessage())), 400);
        }

        // load train schedules
        var rjsSimulation = new RJSSimulation(request.rollingStocks, request.trainSchedules);
        var trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation);

        // load trains successions tables
        List<SuccessionTable> successions = null;

        if (request.successions == null) {
            successions = new ArrayList<>();
            for (var s : infra.switches) {
                successions.add(new SuccessionTable(s.id, new ArrayList<>()));
            }
        }
        else {
            var rjsSuccessions = new RJSSuccessions(request.successions);
            successions = RJSSuccessionsParser.parse(rjsSuccessions);
        }

        // create the simulation and his changelog
        var changeConsumers = new ArrayList<ChangeConsumer>();
        var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
        var sim = Simulation.createFromInfraAndSuccessions(infra, successions, 0, multiplexer);
        var resultLog = new ArrayResultLog(infra, sim);
        multiplexer.add(resultLog);

        // insert the train start events into the simulation
        for (var trainSchedule : trainSchedules)
            TrainCreatedEvent.plan(sim, trainSchedule);

        // run the simulation loop
        while (!sim.isSimulationOver())
            sim.step();

        var simulationResponse = resultLog.getResults();
        return new RsJson(new RsWithBody(adapterResult.toJson(simulationResponse)));
    }

    public static final class SimulationRequest {
        /** Infra id */
        public final String infra;

        /** A list of rolling stocks involved in this simulation */
        @Json(name = "rolling_stocks")
        public Collection<RJSRollingStock> rollingStocks;

        /** A list of trains plannings */
        @Json(name = "train_schedules")
        public Collection<RJSTrainSchedule> trainSchedules;

        /** A list of trains successions tables */
        @Json(name = "successions")
        public Collection<RJSSuccessionTable> successions;

        /** Create SimulationRequest */
        public SimulationRequest(
                String infra,
                Collection<RJSRollingStock> rollingStocks,
                Collection<RJSTrainSchedule> trainSchedules,
                Collection<RJSSuccessionTable> successions
        ) {
            this.infra = infra;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
            this.successions = successions;
        }

        /** Create SimulationRequest with empty successions tables */
        public SimulationRequest(
            String infra,
            Collection<RJSRollingStock> rollingStocks,
            Collection<RJSTrainSchedule> trainSchedules
        )
        {
            this.infra = infra;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
            this.successions = null;
        }
    }


    private static final class ArrayResultLog extends ChangeConsumer {
        private final ArrayList<SimulationResultChange> changes = new ArrayList<>();
        private final Infra infra;
        private final HashMap<String, TrainSchedule> trainSchedules = new HashMap<>();
        private final Simulation sim;

        private ArrayResultLog(Infra infra, Simulation sim) {
            this.infra = infra;
            this.sim = sim;
        }

        @Override
        public void changeCreationCallback(Change change) { }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public void changePublishedCallback(Change change) {
            if (change.getClass() == RouteState.RouteStatusChange.class) {
                var routeStatusChange = (RouteState.RouteStatusChange) change;
                var route = infra.routeGraph.getEdge(routeStatusChange.routeIndex);
                changes.add(new SimulationResultChange.ResponseRouteStatus(
                        route, routeStatusChange.newStatus, sim.getTime()));
            } else if (change.getClass() == Train.TrainStateChange.class) {
                var trainStateChange = (Train.TrainStateChange) change;
                var train = trainSchedules.get(trainStateChange.trainID);
                for (var pos : trainStateChange.positionUpdates)
                    changes.add(new SimulationResultChange.ResponseTrainLocationUpdate(
                            train, pos.pathPosition, pos.time, pos.speed));
            } else if (change.getClass() == TrainCreatedEvent.TrainCreationPlanned.class) {
                var trainCreationPlanned = (TrainCreatedEvent.TrainCreationPlanned) change;
                trainSchedules.put(trainCreationPlanned.schedule.trainID, trainCreationPlanned.schedule);
            } else if (change.getClass() == SignalState.SignalAspectChange.class) {
                var aspectChange = (SignalState.SignalAspectChange) change;
                var signal = infra.signals.get(aspectChange.signalIndex).id;
                var aspects = new ArrayList<String>();
                for (var aspect : aspectChange.aspects)
                    aspects.add(aspect.id);
                changes.add(new SimulationResultChange.ResponseSignalChange(signal, aspects, sim.getTime()));
            } else if (change.getClass() == StopReachedChange.class) {
                var stopReached = (StopReachedChange) change;
                changes.add(new SimulationResultChange.ResponseStopReachedUpdate(stopReached.train,
                        stopReached.stopIndex, sim.getTime()));
            }
        }

        public SimulationResultChange[] getResults() {
            Collections.sort(changes);
            return changes.toArray(new SimulationResultChange[changes.size()]);
        }
    }

    @SuppressFBWarnings({"EQ_COMPARETO_USE_OBJECT_EQUALS"})
    public abstract static class SimulationResultChange implements Comparable<SimulationResultChange> {
        public static final PolymorphicJsonAdapterFactory<SimulationResultChange> adapter = (
                PolymorphicJsonAdapterFactory.of(SimulationResultChange.class, "type")
                        // boolean operators
                        .withSubtype(SimulationResultChange.ResponseRouteStatus.class, "route_status")
                        .withSubtype(SimulationResultChange.ResponseTrainLocationUpdate.class, "train_location")
                        .withSubtype(SimulationResultChange.ResponseSignalChange.class, "signal_change")
                        .withSubtype(SimulationResultChange.ResponseStopReachedUpdate.class, "stop_reached")
        );

        public final double time;

        @Override
        public int compareTo(SimulationResultChange o) {
            if (time < o.time)
                return -1;
            return 1;
        }

        protected SimulationResultChange(double time) {
            this.time = time;
        }

        public static final class ResponseRouteStatus extends SimulationResultChange {
            private final String id;
            private final RouteStatus status;
            @Json(name = "start_track_section")
            private final String startTrackSection;
            @Json(name = "start_offset")
            private final double startOffset;
            @Json(name = "end_track_section")
            private final String endTrackSection;
            @Json(name = "end_offset")
            private final double endOffset;

            ResponseRouteStatus(Route route, RouteStatus status, double time) {
                super(time);
                this.id = route.id;
                this.status = status;
                var firstTvdSectionPathDir = route.tvdSectionsPathDirections.get(0);
                var start = route.tvdSectionsPaths.get(0).getTrackSections(firstTvdSectionPathDir)[0];
                this.startTrackSection = start.edge.id;
                this.startOffset = start.getBeginPosition();
                var lastIndex = route.tvdSectionsPaths.size() - 1;
                var lastTvdSectionPathDir = route.tvdSectionsPathDirections.get(lastIndex);
                var lastTracks = route.tvdSectionsPaths.get(lastIndex).getTrackSections(lastTvdSectionPathDir);
                var end = lastTracks[lastTracks.length - 1];
                this.endTrackSection = end.edge.id;
                this.endOffset = end.getEndPosition();
            }
        }

        public static final class ResponseTrainLocationUpdate extends SimulationResultChange {
            @Json(name = "train_name")
            private final String trainName;
            @Json(name = "head_track_section")
            private final String headTrackSection;
            @Json(name = "head_offset")
            private final double headOffset;
            @Json(name = "tail_track_section")
            private final String tailTrackSection;
            @Json(name = "tail_offset")
            private final double tailOffset;
            private final double speed;

            ResponseTrainLocationUpdate(TrainSchedule trainSchedule, double pathOffset,
                                               double time, double speed) {
                super(time);
                var headLocation = trainSchedule.plannedPath.findLocation(pathOffset);
                this.trainName = trainSchedule.trainID;
                this.headTrackSection = headLocation.edge.id;
                this.headOffset = headLocation.offset;
                var tailLocation = trainSchedule.plannedPath.findLocation(
                        Math.max(0, pathOffset - trainSchedule.rollingStock.length));
                this.tailTrackSection = tailLocation.edge.id;
                this.tailOffset = tailLocation.offset;
                this.speed = speed;
            }
        }

        public static final class ResponseStopReachedUpdate extends SimulationResultChange {
            @Json(name = "train_name")
            private final String trainName;
            @Json(name = "stop_index")
            private final int stopIndex;

            ResponseStopReachedUpdate(Train train, int stopIndex, double time) {
                super(time);
                this.trainName = train.getName();
                this.stopIndex = stopIndex;
            }
        }

        public static final class ResponseSignalChange extends SimulationResultChange {
            private final String signal;
            private final List<String> aspects;

            ResponseSignalChange(String signal, ArrayList<String> aspects, double time) {
                super(time);
                this.signal = signal;
                this.aspects = aspects;
            }
        }
    }
}

