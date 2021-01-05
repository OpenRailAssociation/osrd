package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.utils.BaseChange;
import fr.sncf.osrd.timetable.Timetable;

public final class NewTrainChange extends BaseChange {
    public final Timetable timetable;

    public NewTrainChange(Timetable timetable) {
        this.timetable = timetable;
    }
}
