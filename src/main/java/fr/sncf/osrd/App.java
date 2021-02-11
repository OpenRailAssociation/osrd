package fr.sncf.osrd;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.ConfigManager;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.simulation.SimulationManager;
import fr.sncf.osrd.simulation.utils.ChangeSerializer;
import fr.sncf.osrd.simulation.utils.SimulationError;
import fr.sncf.osrd.timetable.InvalidTimetableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;


public class App {
    static final Logger logger = LoggerFactory.getLogger(App.class);

    /**
     * The main entry point for OSRD.
     * @param args the command line arguments
     */
    public static void main(String[] args)
            throws IOException, InterruptedException, InvalidInfraException, InvalidTimetableException {
        if (args.length != 2) {
            System.err.println("Usage: osrd config.json sim_changelog.json");
            System.exit(1);
        }

        var configPath = args[0];
        var simLogPath = args[1];

        logger.info("parsing the configuration file");
        Config config = ConfigManager.readConfigFile(configPath);

        try {
            logger.info("creating the simulation");
            var simulation = SimulationManager.fromConfig(config, true);

            logger.info("starting the simulation");
            simulation.run();

            var logFile = new File(simLogPath);
            ChangeSerializer.serializeChangeLog(simulation.changelog, logFile);
        } catch (SimulationError simulationError) {
            logger.error("an logic error prevented the simulation from completing", simulationError);
        }
    }
}
