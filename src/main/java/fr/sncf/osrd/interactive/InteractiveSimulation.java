package fr.sncf.osrd.interactive;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.SuccessionTable;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.RJSSuccessionsParser;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.RJSSuccessions;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.railjson.schema.successiontable.RJSSuccessionTable;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.events.TrainCreatedEvent;

import java.util.*;

public class InteractiveSimulation {
    private Infra infra = null;
    private Map<String, RollingStock> extraRollingStocks = new HashMap<>();
    private SessionState state = SessionState.UNINITIALIZED;
    private Simulation simulation = null;

    private void checkState(SessionState expectedState) throws ServerError {
        if (this.state == expectedState)
            return;

        var details = new TreeMap<String, String>();
        details.put("expected", expectedState.name());
        details.put("got", this.state.name());
        var message = new ServerMessage.Error("unexpected session state", details);
        throw new ServerError(message);
    }

    /**
     * Initialize session, building infra and extra rolling stocks
     * @throws ServerError if session isn't uninitialized
     */
    public ServerMessage init(RJSInfra rjsInfra, Collection<RJSRollingStock> extraRJSRollingStocks) throws ServerError {
        checkState(SessionState.UNINITIALIZED);

        try {
            var infra = RailJSONParser.parse(rjsInfra);
            for (var rjsRollingStock : extraRJSRollingStocks) {
                var rollingStock = RJSRollingStockParser.parse(rjsRollingStock);
                extraRollingStocks.put(rollingStock.id, rollingStock);
            }
            this.infra = infra;
            state = SessionState.INITIALIZED;
            return new ServerMessage.SessionInitialized();
        } catch (InvalidInfraException e) {
            return ServerMessage.Error.withReason("failed to parse infra", e.getMessage());
        } catch (InvalidRollingStock e) {
            return ServerMessage.Error.withReason("failed to parse rolling stocks", e.getMessage());
        }
    }

    /**
     * Create simulation given train schedules, rolling stocks and succession tables.
     * @throws ServerError if session isn't initialized.
     */
    public ServerMessage createSimulation(
            List<RJSTrainSchedule> rjsTrainSchedules,
            List<RJSRollingStock> rollingStocks,
            List<RJSSuccessionTable> rjsSuccessions
    ) throws ServerError {
        checkState(SessionState.INITIALIZED);
        var rjsSimulation = new RJSSimulation(rollingStocks, rjsTrainSchedules);
        try {
            var trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation, extraRollingStocks);
            // load trains successions tables
            var successions = new ArrayList<SuccessionTable>();
            if (rjsSuccessions != null) {
                var rjsSuccession = new RJSSuccessions(rjsSuccessions);
                successions = RJSSuccessionsParser.parse(rjsSuccession);
            }
            // insert the train start events into the simulation
            simulation = Simulation.createFromInfraAndSuccessions(infra, successions, 0, null);
            for (var trainSchedule : trainSchedules)
                TrainCreatedEvent.plan(simulation, trainSchedule);
            state = SessionState.RUNNING;
            return new ServerMessage.SimulationCreated();
        } catch (InvalidSchedule e) {
            return ServerMessage.Error.withReason("failed to parse train schedule", e.getMessage());
        } catch (InvalidRollingStock e) {
            return ServerMessage.Error.withReason("failed to parse rolling stock", e.getMessage());
        } catch (InvalidSuccession e) {
            return ServerMessage.Error.withReason("failed to parse succession table", e.getMessage());
        }
    }

    /**
     * Start or resume simulation.
     * @throws ServerError if session isn't running.
     */
    public ServerMessage run() throws ServerError {
        checkState(SessionState.RUNNING);
        // run the simulation loop
        try {
            while (!simulation.isSimulationOver())
                simulation.step();
            state = SessionState.INITIALIZED;
            return new ServerMessage.SimulationFinished();
        } catch (SimulationError e) {
            return ServerMessage.Error.withReason("failed to run simulation", e.getMessage());
        }
    }
}
