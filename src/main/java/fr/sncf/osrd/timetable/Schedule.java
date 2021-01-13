package fr.sncf.osrd.timetable;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.Freezable;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Comparator;

public class Schedule implements Freezable {
    private static final JsonAdapter<JsonSchedule> scheduleAdapter = new Moshi
            .Builder()
            .build()
            .adapter(JsonSchedule.class);

    public final CryoList<TrainSchedule> timetables;

    public Schedule(CryoList<TrainSchedule> timetables) {
        this.timetables = timetables;
    }

    /**
     * Parse a JSON schedule from file
     * @param path the path to the schedule file
     * @param infra a reference to the infra
     */
    public static Schedule fromJSONFile(String path, Infra infra) throws IOException, InvalidInfraException {
        assert infra.isFrozen();
        JsonSchedule json = scheduleAdapter.fromJson(Files.readString(Paths.get(path)));
        var timetables = new CryoList<TrainSchedule>();
        assert json != null;
        for (var jsonTimetable : json.trainSchedules)
            timetables.add(TrainSchedule.fromJson(jsonTimetable, infra));
        timetables.sort(Comparator.comparing(TrainSchedule::getDepartureTime));
        timetables.freeze();
        return new Schedule(timetables);
    }

    @Override
    public void freeze() {
        timetables.freeze();
    }

    @Override
    public boolean isFrozen() {
        return timetables.isFrozen();
    }
}
