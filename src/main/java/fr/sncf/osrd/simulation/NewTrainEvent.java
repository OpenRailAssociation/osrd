package fr.sncf.osrd.simulation;

import fr.sncf.osrd.timetable.Timetable;

public class NewTrainEvent extends BaseEvent {
    public final Timetable timetable;

    public NewTrainEvent(Timetable timetable) {
        this.timetable = timetable;
    }
}
