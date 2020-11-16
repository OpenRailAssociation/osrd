package fr.sncf.osrd;

import fr.sncf.osrd.infra.parsing.RailMLParser;

public class App {
    /**
     * The main entry point for OSRD.
     */
    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("Usage: osrd infra.railml");
            System.exit(1);
        }

        var infraRailMLPath = args[0];
        var infra = new RailMLParser(infraRailMLPath).parse();
        Config config = new Config(1.0f, infra);
        Simulation simulation = new Simulation(config);
        simulation.run();
    }
}
