package fr.sncf.osrd.config;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.parsing.railml.RailMLParser;
import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.util.PathUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;

public class ConfigManager {
    private static final HashMap<String, Infra> infras = new HashMap<>();
    private static final HashMap<Path, Schedule> schedules = new HashMap<>();
    private static final HashMap<Path, RollingStock> rollingStocks = new HashMap<>();

    private static final JsonAdapter<JsonConfig> configAdapter = new Moshi
            .Builder()
            .build()
            .adapter(JsonConfig.class);
    private static final JsonAdapter<RollingStock> rollingStockAdapter = new Moshi
            .Builder()
            .build()
            .adapter(RollingStock.class);

    /**
     * Reads a config file given a filesystem path
     * @param path the path to the configuration file
     * @return a configuration
     * @throws IOException {@inheritDoc}
     * @throws InvalidInfraException {@inheritDoc}
     */
    public static Config readConfigFile(String path) throws IOException, InvalidInfraException {
        var mainConfigPath = Paths.get(path);
        var baseDirPath = mainConfigPath.getParent();
        var jsonConfig = configAdapter.fromJson(Files.readString(mainConfigPath));

        var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        var infra = ConfigManager.getInfra(infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.schedulePath);
        var schedule = ConfigManager.getSchedule(schedulePath, infra);
        return new Config(
                jsonConfig.simulationTimeStep,
                infra,
                schedule,
                jsonConfig.simulationStepPause,
                jsonConfig.showViewer,
                jsonConfig.realTimeViewer,
                jsonConfig.changeReplayCheck
        );
    }

    static Infra getInfra(String path) {
        if (infras.containsKey(path))
            return infras.get(path);
        Infra infra = null;
        try {
            infra = new RailMLParser(path).parse();
            infra.prepare();
        } catch (InvalidInfraException e) {
            e.printStackTrace();
        }
        infras.put(path, infra);
        return infra;
    }

    static Schedule getSchedule(Path path, Infra infra) throws InvalidInfraException {
        if (schedules.containsKey(path))
            return schedules.get(path);
        Schedule schedule = null;
        try {
            schedule = Schedule.fromJSONFile(path, infra);
        } catch (IOException e) {
            e.printStackTrace();
        }
        schedules.put(path, schedule);
        return schedule;
    }

    /**
     * Return a rolling stock if it's already mapped, else create it
     * @param path the path to the rolling stock file
     * @return a RollingStock instance
     */
    public static RollingStock getRollingStock(Path path) throws InvalidInfraException {
        if (rollingStocks.containsKey(path))
            return rollingStocks.get(path);
        RollingStock rollingStock = null;
        try {
            rollingStock = rollingStockAdapter.fromJson(Files.readString(path));
            rollingStock.validate();
        } catch (IOException e) {
            e.printStackTrace();
        }
        rollingStocks.put(path, rollingStock);
        return rollingStock;
    }
}
