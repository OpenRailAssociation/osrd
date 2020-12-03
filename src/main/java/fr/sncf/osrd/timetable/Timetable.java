package fr.sncf.osrd.timetable;

import fr.sncf.osrd.config.ConfigManager;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.util.CryoList;

import java.time.LocalTime;

public class Timetable {
    public final String name;
    public final CryoList<TimetableEntry> entries = new CryoList<>();
    public final RollingStock rollingStock;
    public final double initialSpeed;

    /**
     * Create a new timetable from a json mapped object
     * @param json the json mapped object
     * @param infra a reference to the infra
     */
    public Timetable(JsonTimetable json, Infra infra) {
        name = json.name;
        rollingStock = ConfigManager.getRollingStock(json.rollingStockPath);
        assert json.entries != null;
        for (var jsonEntry : json.entries)
            entries.add(new TimetableEntry(jsonEntry, infra));
        for (int i = 1; i < entries.size(); ++i)
            assert entries.get(i - 1).time.isBefore(entries.get(i).time);
        entries.freeze();
        initialSpeed = json.initialSpeed;
    }

    public LocalTime getDepartureTime() {
        return entries.first().time;
    }
}
