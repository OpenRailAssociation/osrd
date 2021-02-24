package fr.sncf.osrd.config;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railjson.RailJSONParser;
import fr.sncf.osrd.railml.RailMLParser;
import fr.sncf.osrd.timetable.InvalidTimetableException;
import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.PathUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
     * @param mainConfigPath the path to the main JSON configuration file
     * @return a configuration
     * @throws IOException {@inheritDoc}
     * @throws InvalidInfraException {@inheritDoc}
     */
    public static Config readConfigFile(
            Path mainConfigPath
    ) throws IOException, InvalidInfraException, InvalidTimetableException {
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

        try {
            var rjsRoot = RailMLParser.parse(path);
            var infra = RailJSONParser.parse(rjsRoot);
            infras.put(path, infra);
            return infra;
        } catch (InvalidInfraException e) {
            e.printStackTrace();
            return null;
        }
    }

    static Schedule getSchedule(
            Path path,
            Infra infra
    ) throws InvalidInfraException, InvalidTimetableException, IOException {
        if (schedules.containsKey(path))
            return schedules.get(path);

        var schedule = Schedule.fromJSONFile(path, infra);
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

        try {
            var rollingStock = rollingStockAdapter.fromJson(Files.readString(path));
            if (rollingStock == null)
                throw new InvalidInfraException("empty rolling stock");

            rollingStock.validate();
            rollingStocks.put(path, rollingStock);
            return rollingStock;
        } catch (IOException e) {
            throw new InvalidInfraException("failed to read the rolling stock", e);
        }
    }
}
