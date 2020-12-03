package fr.sncf.osrd;

public enum SystemOrdering {
    TIMETABLE(0),
    VIEWER(-1);

    public final int priority;

    SystemOrdering(int priority) {
        this.priority = priority;
    }
}
