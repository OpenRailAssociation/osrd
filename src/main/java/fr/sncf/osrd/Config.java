package fr.sncf.osrd;

import fr.sncf.osrd.infra.Infra;

public class Config {
    public final double SIMULATION_TIME_STEP;
    public final Infra INFRA;

    public Config(double simulation_time_step, Infra infra) {
        SIMULATION_TIME_STEP = simulation_time_step;
        INFRA = infra;
    }
}
