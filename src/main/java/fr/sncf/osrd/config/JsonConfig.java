package fr.sncf.osrd.config;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;

public final class JsonConfig {
    public static final JsonAdapter<JsonConfig> adapter = new Moshi
            .Builder()
            .build()
            .adapter(JsonConfig.class)
            .failOnUnknown();

    @Json(name = "simulation_time_step")
    public final float simulationTimeStep;
    @Json(name = "infra_type")
    public final InfraType infraType;
    @Json(name = "infra_path")
    public final String infraPath;
    @Json(name = "simulation_path")
    public final String simulationPath;
    @Json(name = "succession_path")
    public final String successionPath;
    @Json(name = "show_viewer")
    public final boolean showViewer;
    @Json(name = "realtime_viewer")
    public final boolean realTimeViewer;
    @Json(name = "change_replay_check")
    public final boolean changeReplayCheck;
    @Json(name = "simulation_step_pause")
    public final double simulationStepPause;

    JsonConfig(
            float simulationTimeStep,
            InfraType infraType,
            String infraPath,
            String simulationPath,
            String successionPath,
            boolean showViewer,
            boolean realTimeViewer,
            boolean changeReplayCheck,
            double simulationStepPause
    ) {
        this.simulationTimeStep = simulationTimeStep;
        this.infraType = infraType;
        this.infraPath = infraPath;
        this.simulationPath = simulationPath;
        this.successionPath = successionPath;
        this.showViewer = showViewer;
        this.realTimeViewer = realTimeViewer;
        this.changeReplayCheck = changeReplayCheck;
        this.simulationStepPause = simulationStepPause;
    }

    public enum InfraType {
        RAILML,
        RAILJSON,
        UNKNOWN,
    }
}
