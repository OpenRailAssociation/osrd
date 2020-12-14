package fr.sncf.osrd.simulation;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.train.Train;

import java.util.HashSet;

/**
 * The world object can be read everywhere in the simulation.
 * It's meant as a centralized repository for the state of the simulation.
 */
public class World {
    public final Infra infra;
    public final Config config;
    public SchedulerSystem scheduler = null;
    public final HashSet<Train> trains = new HashSet<>();

    /**
     * Create the world from a configuration
     * @param config the configuration of the simulation
     */
    public World(Config config) {
        // it's redundant but useful
        this.infra = config.infra;
        this.config = config;
    }
}
