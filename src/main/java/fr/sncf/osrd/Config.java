package fr.sncf.osrd;

import fr.sncf.osrd.infra.Infra;

public class Config {
    public final float SIMULATION_TIME_STEP;
    public final Infra INFRA;

    public Config(float simulationTimeStep, Infra infra) {
        SIMULATION_TIME_STEP = simulationTimeStep;
        INFRA = infra;
    }
}
