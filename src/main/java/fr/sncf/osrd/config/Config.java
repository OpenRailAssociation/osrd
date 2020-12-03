package fr.sncf.osrd.config;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.timetable.Schedule;

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
    public Config(JsonConfig jsonConfig) {
        simulationTimeStep = jsonConfig.simulationTimeStep;
        infra = ConfigManager.getInfra(jsonConfig.infraPath);
        schedule = ConfigManager.getSchedule(jsonConfig.schedulePath, infra);
        showViewer = jsonConfig.showViewer;
        simulationStepPause = jsonConfig.simulationStepPause;
    }

}
