package fr.sncf.osrd;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.ConfigManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;


public class App {
    /**
     * The main entry point for OSRD.
     * @param args the command line arguments
     */
    public static void main(String[] args) throws IOException, InterruptedException {
        if (args.length == 0) {
            System.err.println("Usage: osrd config.json:");
            System.exit(1);
        }

        Config config = ConfigManager.getConfig(Files.readString(Paths.get(args[0])));
        Simulation simulation = new Simulation(config);
        simulation.run();
    }
}
