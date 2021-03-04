package fr.sncf.osrd.timetable;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.utils.CryoList;
import fr.sncf.osrd.utils.Freezable;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

public class Schedule implements Freezable {
    public final CryoList<TrainSchedule> trainSchedules;

    public Schedule(CryoList<TrainSchedule> trainSchedules) {
        this.trainSchedules = trainSchedules;
    }

    /**
     * Parse a JSON schedule from file
     * @param path the path to the schedule file
     * @param infra a reference to the infra
     */
    public static Schedule fromJSONFile(
            Path path,
            Infra infra
    ) throws IOException, InvalidInfraException, InvalidTimetableException {
        JsonSchedule json = JsonSchedule.adapter.fromJson(Files.readString(path));
        var timetables = new CryoList<TrainSchedule>();
        assert json != null;
        var base = path.getParent();
        for (var jsonTimetable : json.trainSchedules)
            timetables.add(TrainSchedule.fromJson(base, jsonTimetable, infra));
        timetables.sort(Comparator.comparing(TrainSchedule::getDepartureTime));
        timetables.freeze();
        return new Schedule(timetables);
    }

    @Override
    public void freeze() {
        trainSchedules.freeze();
    }

    @Override
    public boolean isFrozen() {
        return trainSchedules.isFrozen();
    }
}
