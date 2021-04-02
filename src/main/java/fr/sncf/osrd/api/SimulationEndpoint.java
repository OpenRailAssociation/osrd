package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
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
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;

public class SimulationEndpoint implements Take {
    private final Infra infra;

    public static final JsonAdapter<SimulationResultChange[]> adapterResult = new Moshi
            .Builder()
            .add(SimulationResultChange.adapter)
            .build()
            .adapter(SimulationResultChange[].class);

    public SimulationEndpoint(Infra infra) {
        this.infra = infra;
    }

    @Override
    public Response act(Request req) throws IOException, InvalidRollingStock, InvalidSchedule, SimulationError {
        var buffer = new okio.Buffer();
        buffer.write(req.body().readAllBytes());

        // Parse request input
        var rjsSimulation = RJSSimulation.adapter.fromJson(buffer);
        if (rjsSimulation == null)
            return new RsWithStatus(new RsText("missing request body"), 400);
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
