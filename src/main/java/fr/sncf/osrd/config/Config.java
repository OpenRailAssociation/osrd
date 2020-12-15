package fr.sncf.osrd.config;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.timetable.Schedule;

@SuppressFBWarnings(value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class Config {
    public final float simulationTimeStep;
    public final Infra infra;
    public final Schedule schedule;
    public final double simulationStepPause;
    public final boolean showViewer;

    /**
     * Create a config from a json mapped object
     * @param jsonConfig the json mapped object
     */
    public Config(JsonConfig jsonConfig) throws InvalidInfraException {
        simulationTimeStep = jsonConfig.simulationTimeStep;
        infra = ConfigManager.getInfra(jsonConfig.infraPath);
        schedule = ConfigManager.getSchedule(jsonConfig.schedulePath, infra);
        showViewer = jsonConfig.showViewer;
        simulationStepPause = jsonConfig.simulationStepPause;
    }
}
