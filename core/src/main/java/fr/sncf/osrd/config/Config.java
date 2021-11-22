package fr.sncf.osrd.config;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.infra_state.regulator.TrainSuccessionTable;
import fr.sncf.osrd.utils.PathUtils;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Config {
    public final Infra infra;
    public final List<TrainSchedule> trainSchedules;
    public final List<TrainSuccessionTable> switchSuccessions;
    public final double simulationStepPause;
    public final boolean showViewer;
    public final boolean realTimeViewer;
    public final boolean changeReplayCheck;

    /** Creates a new configuration */
    public Config(
            Infra infra,
            List<TrainSchedule> trainSchedules,
            List<TrainSuccessionTable> switchSuccessions,
            double simulationStepPause,
            boolean showViewer,
            boolean realTimeViewer,
            boolean changeReplayCheck
    ) {
        this.infra = infra;
        this.trainSchedules = trainSchedules;
        this.switchSuccessions = switchSuccessions;
        this.simulationStepPause = simulationStepPause;
        this.showViewer = showViewer;
        this.realTimeViewer = realTimeViewer;
        this.changeReplayCheck = changeReplayCheck;
    }

    /** Parses the configuration from a file */
    public static Config readFromFile(
            Path mainConfigPath
    ) throws IOException, InvalidInfraException, InvalidRollingStock, InvalidSchedule, InvalidSuccession {
        var baseDirPath = mainConfigPath.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, mainConfigPath);
        var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        var infra = Infra.parseFromFile(jsonConfig.infraType, infraPath.toString());
        return makeWithGivenInfra(mainConfigPath, infra);
    }

    /** Parse all serialized .json rolling stock files and add these to the given map */
    public static void parseExtraRollingStocks(
            Map<String, RollingStock> res,
            Path dirPath
    ) throws IOException, InvalidRollingStock {
        var jsonMatcher = FileSystems.getDefault().getPathMatcher("glob:**.json");
        var rollingStocksPaths = Files.list(dirPath)
                .filter((path) -> path.toFile().isFile())
                .filter(jsonMatcher::matches)
                .collect(Collectors.toList());

        for (var filePath : rollingStocksPaths) {
            var rjsRollingStock = MoshiUtils.deserialize(RJSRollingStock.adapter, filePath);
            var rollingStock = RJSRollingStockParser.parse(rjsRollingStock);
            res.put(rollingStock.id, rollingStock);
        }
    }

    /** Create the configuration from a file and a given Infra */
    public static Config makeWithGivenInfra(
            Path mainConfigPath,
            Infra infra
    ) throws IOException, InvalidRollingStock, InvalidSchedule, InvalidSuccession {
        var baseDirPath = mainConfigPath.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, mainConfigPath);
        var simulationPath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var rjsSimulation = MoshiUtils.deserialize(RJSSimulation.adapter, simulationPath);

        List<TrainSchedule> trainSchedules;
        if (jsonConfig.extraRollingStockDirs != null) {
            var extraRollingStocks = new HashMap<String, RollingStock>();
            for (var extraRollingStockDir : jsonConfig.extraRollingStockDirs) {
                var extraRollingStocksPath = PathUtils.relativeTo(baseDirPath, extraRollingStockDir);
                parseExtraRollingStocks(extraRollingStocks, extraRollingStocksPath);
            }
            trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation, extraRollingStocks);
        } else {
            trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation);
        }

        // add default trains successions tables
        var trainSuccessionTables = RJSSimulationParser.parseTrainSuccessionTables(rjsSimulation);

        return new Config(
                infra,
                trainSchedules,
                trainSuccessionTables,
                jsonConfig.simulationStepPause,
                jsonConfig.showViewer,
                jsonConfig.realTimeViewer,
                jsonConfig.changeReplayCheck
        );
    }
}
