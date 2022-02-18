package fr.sncf.osrd.railjson.parser.exceptions;

public class UnknownTrackSection extends InvalidSchedule {
    private static final long serialVersionUID = -7305193783954300262L;
    public static final String osrdErrorType = "unknown_track";

    public final String trackSectionID;

    public UnknownTrackSection(String message, String trackSectionID) {
        super(message);
        this.trackSectionID = trackSectionID;
    }
}
