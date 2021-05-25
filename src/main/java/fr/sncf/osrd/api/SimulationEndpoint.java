package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSRunningTimeParameters;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.OperationalPointChange;
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
            .add(RJSRunningTimeParameters.adapter)
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
    public Response act(Request req) throws IOException, InvalidRollingStock, InvalidSchedule, SimulationError {
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

        var rjsSimulation = new RJSSimulation(request.rollingStocks, request.trainSchedules);
        var trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation);

        // create the simulation and his changelog
        var changeConsumers = new ArrayList<ChangeConsumer>();
        var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
        var sim = Simulation.createFromInfra(infra, 0, multiplexer);
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

        /** Create SimulationRequest */
        public SimulationRequest(
                String infra,
                Collection<RJSRollingStock> rollingStocks,
                Collection<RJSTrainSchedule> trainSchedules
        ) {
            this.infra = infra;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
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
                var routeId = infra.routeGraph.getEdge(routeStatusChange.routeIndex).id;
                changes.add(new SimulationResultChange.ResponseRouteStatus(
                        routeId, routeStatusChange.newStatus, sim.getTime()));
            } else if (change.getClass() == Train.TrainStateChange.class) {
                var trainStateChange = (Train.TrainStateChange) change;
                var train = trainSchedules.get(trainStateChange.trainID);
                for (var pos : trainStateChange.positionUpdates)
                    changes.add(new SimulationResultChange.ResponseTrainLocationUpdate(
                            train, pos.pathPosition, pos.time));
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
            } else if (change.getClass() == OperationalPointChange.class) {
                var opChange = (OperationalPointChange) change;
                var train = opChange.train.schedule;
                var op = opChange.op;
                changes.add(new SimulationResultChange.ResponseOperationalPointUpdate(train, op, sim.getTime()));
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
                        .withSubtype(SimulationResultChange.ResponseOperationalPointUpdate.class, "operational_point")
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

        private static final class ResponseRouteStatus extends SimulationResultChange {
            private final String id;
            private final RouteStatus status;

            public ResponseRouteStatus(String routeId, RouteStatus status, double time) {
                super(time);
                this.id = routeId;
                this.status = status;
            }
        }

        private static final class ResponseTrainLocationUpdate extends SimulationResultChange {
            @Json(name = "train_name")
            private final String trainName;
            @Json(name = "track_section")
            private final String trackSection;
            private final double offset;

            public ResponseTrainLocationUpdate(TrainSchedule trainSchedule, double pathOffset, double time) {
                super(time);
                var location = trainSchedule.findLocation(pathOffset);
                this.trainName = trainSchedule.trainID;
                this.trackSection = location.edge.id;
                this.offset = location.offset;
            }
        }

        private static final class ResponseOperationalPointUpdate extends SimulationResultChange {
            @Json(name = "train_name")
            private final String trainName;
            @Json(name = "operational_point")
            private final String operationalPoint;

            public ResponseOperationalPointUpdate(TrainSchedule trainSchedule, OperationalPoint op, double time) {
                super(time);
                this.trainName = trainSchedule.trainID;
                this.operationalPoint = op.id;
            }
        }

        private static final class ResponseSignalChange extends SimulationResultChange {
            private final String signal;
            private final List<String> aspects;

            public ResponseSignalChange(String signal, ArrayList<String> aspects, double time) {
                super(time);
                this.signal = signal;
                this.aspects = aspects;
            }
        }
    }
}
