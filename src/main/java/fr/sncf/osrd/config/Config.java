package fr.sncf.osrd.config;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.utils.PathUtils;
import fr.sncf.osrd.utils.moshi.MoshiUtils;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Config {
    public final float simulationTimeStep;
    public final Infra infra;
    public final List<TrainSchedule> trainSchedules;
    public final double simulationStepPause;
    public final boolean showViewer;
    public final boolean realTimeViewer;
    public final boolean changeReplayCheck;

    /** Creates a new configuration */
    public Config(
            float simulationTimeStep,
            Infra infra,
            List<TrainSchedule> trainSchedules,
            double simulationStepPause,
            boolean showViewer,
            boolean realTimeViewer,
            boolean changeReplayCheck
    ) {
        this.simulationTimeStep = simulationTimeStep;
        this.infra = infra;
        this.trainSchedules = trainSchedules;
        this.simulationStepPause = simulationStepPause;
        this.showViewer = showViewer;
        this.realTimeViewer = realTimeViewer;
        this.changeReplayCheck = changeReplayCheck;
    }

    /** Parses the configuration from a file */
    public static Config readFromFile(
            Path mainConfigPath
    ) throws IOException, InvalidInfraException, InvalidRollingStock, InvalidSchedule {
        var baseDirPath = mainConfigPath.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, mainConfigPath);
        var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        var infra = Infra.parseFromFile(jsonConfig.infraType, infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);
        var trainSchedules = RJSSimulationParser.parse(infra, schedule);
        return new Config(
                jsonConfig.simulationTimeStep,
                infra,
                trainSchedules,
                jsonConfig.simulationStepPause,
                jsonConfig.showViewer,
                jsonConfig.realTimeViewer,
                jsonConfig.changeReplayCheck
        );
    }
}
