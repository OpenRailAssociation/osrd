package fr.sncf.osrd;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.ConfigManager;
import fr.sncf.osrd.infra.InvalidInfraException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;


public class App {
    static final Logger logger = LoggerFactory.getLogger(App.class);

    /**
     * The main entry point for OSRD.
     * @param args the command line arguments
     */
    public static void main(String[] args) throws IOException, InterruptedException, InvalidInfraException {
        if (args.length == 0) {
            System.err.println("Usage: osrd config.json:");
            System.exit(1);
        }

        logger.info("parsing the configuration file");
        Config config = ConfigManager.getConfig(Files.readString(Paths.get(args[0])));

        logger.info("creating the simulation");
        Simulation simulation = new Simulation(config);

        logger.info("starting the simulation");
        simulation.run();
    }
}
