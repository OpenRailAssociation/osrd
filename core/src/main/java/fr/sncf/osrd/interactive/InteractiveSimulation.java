package fr.sncf.osrd.interactive;

import fr.sncf.osrd.api.SimulationEndpoint;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.interactive.client_messages.ChangeType;
import fr.sncf.osrd.interactive.client_messages.EventType;
import fr.sncf.osrd.interactive.events_adapters.SerializedEvent;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSVirtualPoint;
import fr.sncf.osrd.railjson.schema.successiontable.RJSTrainSuccessionTable;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

public class InteractiveSimulation {
    private Infra infra = null;
    private final Map<String, RollingStock> extraRollingStocks = new HashMap<>();
    private SessionState state = SessionState.UNINITIALIZED;
    public Simulation simulation = null;
    private final ResponseCallback responseCallback;
    public Set<ChangeType> watchedChangeTypes = new HashSet<>();
    public SimulationEndpoint.ArrayResultLog resultLog = null;

    public InteractiveSimulation(ResponseCallback responseCallback) {
        this.responseCallback = responseCallback;
    }

    public void sendResponse(ServerMessage message) throws IOException {
        responseCallback.send(message);
    }

    private boolean expectState(SessionState... validStates) throws IOException {
        for (var validState : validStates)
            if (validState == this.state)
                return false;

        var validStateNames = Arrays.stream(validStates).map(Enum::name).collect(Collectors.joining(" or "));
        var details = new TreeMap<String, String>();
        details.put("expected", validStateNames);
        details.put("got", this.state.name());
        sendResponse(new ServerMessage.Error("unexpected session state", details));
        return true;
    }

    /**
     * Initialize session, building infra and extra rolling stocks
     */
    public void init(RJSInfra rjsInfra, Collection<RJSRollingStock> extraRJSRollingStocks) throws IOException {
        if (expectState(SessionState.UNINITIALIZED))
            return;

        try {
            var infra = RailJSONParser.parse(rjsInfra);
            for (var rjsRollingStock : extraRJSRollingStocks) {
                var rollingStock = RJSRollingStockParser.parse(rjsRollingStock);
                extraRollingStocks.put(rollingStock.id, rollingStock);
            }
            this.infra = infra;
            state = SessionState.WAITING_FOR_SIMULATION;
            sendResponse(new ServerMessage.SessionInitialized());
        } catch (InvalidInfraException e) {
            sendResponse(ServerMessage.Error.withReason("failed to parse infra", e.getMessage()));
        } catch (InvalidRollingStock e) {
            sendResponse(ServerMessage.Error.withReason("failed to parse rolling stocks", e.getMessage()));
        }
    }

    /**
     * Create simulation given train schedules, rolling stocks and succession tables.
     */
    public void createSimulation(
            List<RJSTrainSchedule> rjsTrainSchedules,
            List<RJSRollingStock> rollingStocks,
            List<RJSTrainSuccessionTable> rjsSuccessions,
            List<RJSVirtualPoint> virtualPoints
    ) throws IOException {
        if (expectState(SessionState.WAITING_FOR_SIMULATION, SessionState.SIMULATION_COMPLETE))
            return;

        var rjsSimulation = new RJSSimulation(rollingStocks, rjsTrainSchedules, rjsSuccessions);
        try {
            final var trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation,
                    extraRollingStocks, virtualPoints);
            // load trains successions tables
            final var successions = RJSSimulationParser.parseTrainSuccessionTables(rjsSimulation);
            // Create changes consumers
            final var streamChangesConsumer = new StreamChangesConsumer(this);
            final var changeConsumers = new ArrayList<ChangeConsumer>();
            final var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
            // Create the simulation
            simulation = Simulation.createFromInfraAndSuccessions(infra, successions, 0, multiplexer);
            resultLog = new SimulationEndpoint.ArrayResultLog(infra, simulation);
            multiplexer.add(resultLog);
            multiplexer.add(streamChangesConsumer);
            // insert the train start events into the simulation
            for (var trainSchedule : trainSchedules)
                TrainCreatedEvent.plan(simulation, trainSchedule);
            state = SessionState.PAUSED;
            sendResponse(new ServerMessage.SimulationCreated());
        } catch (InvalidSchedule e) {
            sendResponse(ServerMessage.Error.withReason("failed to parse train schedule", e.getMessage()));
        } catch (InvalidRollingStock e) {
            sendResponse(ServerMessage.Error.withReason("failed to parse rolling stock", e.getMessage()));
        } catch (InvalidSuccession e) {
            sendResponse(ServerMessage.Error.withReason("failed to parse succession table", e.getMessage()));
        }
    }

    /**
     * Start or resume simulation.
     * @param untilEvents A list of event types after which the simulation must pause
     */
    public void run(Set<EventType> untilEvents) throws IOException {
        if (expectState(SessionState.PAUSED))
            return;

        // run the simulation loop
        try {
            state = SessionState.RUNNING;
            while (!simulation.isSimulationOver()) {
                var event = simulation.step();
                var eventType = EventType.fromEvent(event);
                if (eventType != null && untilEvents.contains(eventType)) {
                    state = SessionState.PAUSED;
                    var serializedEvent = SerializedEvent.from(event);
                    sendResponse(new ServerMessage.SimulationPaused(serializedEvent));
                    return;
                }
            }
            state = SessionState.SIMULATION_COMPLETE;
            sendResponse(new ServerMessage.SimulationComplete(resultLog.simplify().result));
        } catch (SimulationError e) {
            sendResponse(ServerMessage.Error.withReason("failed to run simulation", e.getMessage()));
        }
    }

    public void watchChangesTypes(Set<ChangeType> changeTypes) throws IOException {
        watchedChangeTypes = changeTypes;
        sendResponse(new ServerMessage.WatchChanges());
    }

    /** Sends back to the client the list of delays for all requested trains */
    public void sendTrainDelays(Collection<String> trains) throws IOException {
        if (expectState(SessionState.PAUSED, SessionState.SIMULATION_COMPLETE))
            return;

        var curTime = simulation.getTime();
        var trainDelays = new HashMap<String, Double>();
        if (trains != null) {
            for (var trainId : trains) {
                var train = simulation.trains.get(trainId);
                // when a train can't be found, its delay is set to null
                var delay = train == null ? null : train.getDelay(curTime);
                trainDelays.put(trainId, delay);
            }
        } else {
            for (var train : simulation.trains.values())
                trainDelays.put(train.getID(), train.getDelay(curTime));
        }
        sendResponse(new ServerMessage.TrainDelays(trainDelays));
    }

    /** Sends back to the client the train succession tables.
     * If waiting for simulation then return the completed TST of last simulation.
     * @param switches only return tst of the given switches. If `null` or empty then return the whole list.
     */
    public void sendTrainSuccessionTables(List<String> switches) throws IOException {
        if (expectState(SessionState.PAUSED, SessionState.SIMULATION_COMPLETE))
            return;
        var tstLogs = simulation.infraState.towerState.trainSuccessionLog;
        // Return the whole list
        if (switches == null || switches.isEmpty()) {
            var tst = new HashMap<String, List<String>>(tstLogs);
            sendResponse(new ServerMessage.TrainSuccessionTables(tst));
            return;
        }
        // Return tst of the given switch list
        var tst = new HashMap<String, List<String>>();
        for (var switchID : switches) {
            if (!tstLogs.containsKey(switchID)) {
                sendResponse(ServerMessage.Error.withReason(
                        "Couldn't send succession tables",
                        String.format("Switch '%s' doesn't exist", switchID)));
                return;
            }
            tst.put(switchID, tstLogs.get(switchID));
        }
        sendResponse(new ServerMessage.TrainSuccessionTables(tst));
    }

    /** Update a train succession tables */
    public void updateTrainSuccessionTable(List<RJSTrainSuccessionTable> trainSuccessionTables) throws IOException {
        if (expectState(SessionState.PAUSED))
            return;
        var towerState = simulation.infraState.towerState;
        try {
            for (var newTST : trainSuccessionTables) {
                var tst = towerState.trainSuccessionTables.get(newTST.switchID);
                var trainOrder = new ArrayDeque<>(List.of(newTST.trainOrder));
                tst.changeTrainOrder(simulation, trainOrder);
            }
        } catch (SimulationError e) {
            sendResponse(ServerMessage.Error.withReason("failed to update train succession tables", e.getMessage()));
        }
        sendResponse(new ServerMessage.TrainSuccessionTablesUpdated());
    }
}
