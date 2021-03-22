package fr.sncf.osrd.config;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.utils.PathUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Config {
    public final float simulationTimeStep;
    public final Infra infra;
    public final double simulationStepPause;
    public final boolean showViewer;
    public final boolean realTimeViewer;
    public final boolean changeReplayCheck;

    /**
     * Creates a new configuration
     * @param simulationTimeStep the simulation time step
     * @param infra the infrastructure to simulate on
     * @param simulationStepPause the time to wait between simulation steps
     * @param showViewer whether to show the gui viewer
     * @param realTimeViewer whether the viewer should interpolate the train's movement to be realtime
     * @param changeReplayCheck whether to check for replay errors
     */
    public Config(
            float simulationTimeStep,
            Infra infra,
            double simulationStepPause,
            boolean showViewer,
            boolean realTimeViewer,
            boolean changeReplayCheck
    ) {
        this.simulationTimeStep = simulationTimeStep;
        this.infra = infra;
        this.simulationStepPause = simulationStepPause;
        this.showViewer = showViewer;
        this.realTimeViewer = realTimeViewer;
        this.changeReplayCheck = changeReplayCheck;
    }

    /** Parses the configuration from a file */
    public static Config readFromFile(
            Path mainConfigPath
    ) throws IOException, InvalidInfraException {
        var baseDirPath = mainConfigPath.getParent();
        var jsonConfig = JsonConfig.adapter.fromJson(Files.readString(mainConfigPath));
        var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        var infra = Infra.parseFromFile(jsonConfig.infraType, infraPath.toString());
        return new Config(
                jsonConfig.simulationTimeStep,
                infra,
                jsonConfig.simulationStepPause,
                jsonConfig.showViewer,
                jsonConfig.realTimeViewer,
                jsonConfig.changeReplayCheck
        );
    }
}
