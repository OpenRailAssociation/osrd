package fr.sncf.osrd.config;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.parsing.railml.RailMLParser;
import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.train.RollingStock;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;

public class ConfigManager {
    private static final HashMap<String, Infra> infras = new HashMap<>();
    private static final HashMap<String, Schedule> schedules = new HashMap<>();
    private static final HashMap<String, RollingStock> rollingStocks = new HashMap<>();

    private static final JsonAdapter<JsonConfig> configAdapter = new Moshi
            .Builder()
            .build()
            .adapter(JsonConfig.class);
    private static final JsonAdapter<RollingStock> rollingStockAdapter = new Moshi
            .Builder()
            .build()
            .adapter(RollingStock.class);

    public static Config getConfig(String json) throws IOException, InvalidInfraException {
        return new Config(configAdapter.fromJson(json));
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

    static Schedule getSchedule(String path, Infra infra) throws InvalidInfraException {
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
    public static RollingStock getRollingStock(String path) throws InvalidInfraException {
        if (rollingStocks.containsKey(path))
            return rollingStocks.get(path);
        RollingStock rollingStock = null;
        try {
            rollingStock = rollingStockAdapter.fromJson(Files.readString(Paths.get(path)));
            rollingStock.validate();
        } catch (IOException e) {
            e.printStackTrace();
        }
        rollingStocks.put(path, rollingStock);
        return rollingStock;
    }
}
