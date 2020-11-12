package fr.sncf.osrd;

public enum SystemOrdering {
    TIMETABLE(0);

    private int priority;

    public int getPriority() {
        return priority;
    }

    SystemOrdering(int priority) {
        this.priority = priority;
    }
}
