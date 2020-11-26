package fr.sncf.osrd;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;

@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public class Config {
    public final float SIMULATION_TIME_STEP;
    public final Infra INFRA;

    public Config(float simulationTimeStep, Infra infra) {
        SIMULATION_TIME_STEP = simulationTimeStep;
        INFRA = infra;
    }
}
