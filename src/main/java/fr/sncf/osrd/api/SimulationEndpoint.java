package fr.sncf.osrd.api;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rs.RsText;
import org.takes.rs.RsWithStatus;

import java.io.IOException;

public class SimulationEndpoint implements Take {
    private final Infra infra;

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
        var changelog = new ArrayChangeLog();
        var sim = Simulation.createFromInfra(infra, 0, changelog);

        // insert the train start events into the simulation
        for (var trainSchedule : trainSchedules)
            TrainCreatedEvent.plan(sim, trainSchedule);

        // run the simulation loop
        while (!sim.isSimulationOver())
            sim.step();

        // TODO Define endpoint output
        return new RsText("ok");
    }
}
