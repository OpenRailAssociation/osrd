package fr.sncf.osrd;

public enum SystemOrdering {
    TIMETABLE(0),
    VIEWER(-1);

    private int priority;

    public int getPriority() {
        return priority;
    }

    SystemOrdering(int priority) {
        this.priority = priority;
    }
}
