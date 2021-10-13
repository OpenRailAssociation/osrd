package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import com.beust.jcommander.converters.PathConverter;
import fr.sncf.osrd.DebugViewer;
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
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;

@Parameters(commandDescription = "Runs a simulation")
public final class SimulateCommand implements CliCommand {
    static final Logger logger = LoggerFactory.getLogger(SimulateCommand.class);

    @Parameter(
            names = { "-c", "--config" },
            description = "The main JSON configuration file for the simulation",
            required = true,
            converter = PathConverter.class
    )
    private Path configPath;

    @Parameter(
            names = { "-o", "--output-changelog" },
            description = "Serialize the changelog to JSON, and write it to the given path",
            required = true,
            converter = PathConverter.class
    )
    private Path outputChangelogPath;

    /** Runs the command, and return a status code */
    public int run() {
        try {
            logger.info("parsing the configuration file");
            Config config = Config.readFromFile(configPath);

            logger.info("starting the simulation");
            var changeConsumers = new ArrayList<ChangeConsumer>();
            var changelog = new ArrayChangeLog();
            changeConsumers.add(changelog);

            // create the simulation and add change consumers
            var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
            var sim = Simulation.createFromInfraAndSuccessions(config.infra, config.switchSuccessions, 0, multiplexer);

            if (config.changeReplayCheck)
                multiplexer.add(ChangeReplayChecker.from(sim));

            // create the viewer
            if (config.showViewer)
                multiplexer.add(DebugViewer.from(config.infra, config.realTimeViewer, config.simulationStepPause));

            // insert the train start events into the simulation
            for (var trainSchedule : config.trainSchedules)
                TrainCreatedEvent.plan(sim, trainSchedule);

            // run the simulation loop
            while (!sim.isSimulationOver())
                sim.step();

            logger.info("done simulating");
            ChangeLogSummarizer.summarize(changelog);

            logger.debug("serializing changes");
            ChangeSerializer.serializeChangeLog(changelog, outputChangelogPath);
            return 0;
        } catch (SimulationError simulationError) {
            logger.error("an logic error prevented the simulation from completing", simulationError);
            return 1;
        } catch (InvalidInfraException | InvalidRollingStock | InvalidSchedule | InvalidSuccession exception) {
            logger.error("an error occurred while parsing the input", exception);
            return 1;
        } catch (IOException ioException) {
            logger.error("IO error", ioException);
            return 1;
        }
    }
}