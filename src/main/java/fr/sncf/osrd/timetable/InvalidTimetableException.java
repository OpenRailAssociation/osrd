package fr.sncf.osrd.timetable;

public class InvalidTimetableException extends Exception {
    private static final long serialVersionUID = 3021298858885234550L;

    public InvalidTimetableException(String message) {
        super(message);
    }

    public InvalidTimetableException(String message, Throwable err) {
        super(message, err);
    }
}
