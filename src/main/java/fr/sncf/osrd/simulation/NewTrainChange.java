package fr.sncf.osrd.simulation;

import fr.sncf.osrd.timetable.Timetable;

public class NewTrainChange extends BaseChange {
    public final Timetable timetable;

    public NewTrainChange(Timetable timetable) {
        this.timetable = timetable;
    }
}
