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
    public float simulationTimeStep;
    @Json(name = "infra_type")
    public InfraType infraType;
    @Json(name = "infra_path")
    public String infraPath;
    @Json(name = "simulation_path")
    public String simulationPath;
    @Json(name = "extra_rolling_stock_dirs")
    public String[] extraRollingStockDirs;
    @Json(name = "show_viewer")
    public boolean showViewer;
    @Json(name = "realtime_viewer")
    public boolean realTimeViewer;
    @Json(name = "change_replay_check")
    public boolean changeReplayCheck;
    @Json(name = "simulation_step_pause")
    public double simulationStepPause;

    public enum InfraType {
        RAILJSON,
        UNKNOWN,
    }
}
