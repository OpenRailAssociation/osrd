package fr.sncf.osrd;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.train.TrainStatus.REACHED_DESTINATION;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.simulation.ChangeReplayChecker;
import fr.sncf.osrd.simulation.ChangeSerializer;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import fr.sncf.osrd.simulation.changelog.ChangeLogSummarizer;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import okio.Buffer;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.util.ArrayList;

public class RunExamplesTest {
    private static void runGivenConfigInfra(String path, int nExpectedTrainsArrived)
            throws InvalidRollingStock, InvalidSuccession,
            InvalidSchedule, IOException, InvalidInfraException, SimulationError {
        Config config = Config.readFromFile(getResourcePath(path));

        var changeConsumers = new ArrayList<ChangeConsumer>();
        var changelog = new ArrayChangeLog();
        changeConsumers.add(changelog);

        var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
        var sim = Simulation.createFromInfraAndSuccessions(config.infra,
                config.switchSuccessions, 0, multiplexer);

        multiplexer.add(ChangeReplayChecker.from(sim));

        for (var trainSchedule : config.trainSchedules)
            TrainCreatedEvent.plan(sim, trainSchedule);

        while (!sim.isSimulationOver())
            sim.step();

        ChangeLogSummarizer.summarize(changelog);

        ChangeSerializer.serializeChangeLog(changelog, new Buffer());

        var nTrainsArrived = sim.trains.values().stream()
                .map(Train::getLastState)
                .filter(trainState -> trainState.status.equals(REACHED_DESTINATION))
                .count();
        assertEquals(nExpectedTrainsArrived, nTrainsArrived);
    }

    @Test
    public void testTinyInfra() throws InvalidRollingStock, InvalidSuccession,
            InvalidSchedule, IOException, InvalidInfraException, SimulationError {
        runGivenConfigInfra("tiny_infra/config_railjson.json", 1);
    }

    @Disabled("see issue https://github.com/DGEXSolutions/osrd-core/issues/216")
    @Test
    public void testCircularInfra() throws InvalidRollingStock, InvalidSuccession,
            InvalidSchedule, IOException, InvalidInfraException, SimulationError {
        runGivenConfigInfra("circular_infra/config.json", 0);
    }

    @Test
    public void testSlowMaxSpeedInfra() throws InvalidRollingStock, InvalidSuccession,
            InvalidSchedule, IOException, InvalidInfraException, SimulationError {
        runGivenConfigInfra("bug_slow_max_speed/config.json", 2);
    }

    @Test
    public void testConvergencesDelayed() throws InvalidRollingStock, InvalidSuccession,
            InvalidSchedule, IOException, InvalidInfraException, SimulationError {
        runGivenConfigInfra("bug_convergences/config_delayed.json", 3);
    }

    @Test
    public void testConvergences() throws InvalidRollingStock, InvalidSuccession,
            InvalidSchedule, IOException, InvalidInfraException, SimulationError {
        runGivenConfigInfra("bug_convergences/config.json", 3);
    }

    @Test
    public void testLineInfra() throws InvalidRollingStock, InvalidSuccession,
            InvalidSchedule, IOException, InvalidInfraException, SimulationError {
        runGivenConfigInfra("one_line/config.json", 0);
    }
}
