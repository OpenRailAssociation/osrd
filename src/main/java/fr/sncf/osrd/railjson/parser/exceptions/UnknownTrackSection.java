package fr.sncf.osrd.railjson.parser.exceptions;

public class UnknownTrackSection extends InvalidSchedule {
    static final long serialVersionUID = 7445678015904414750L;

    public final String trackSectionID;

    public UnknownTrackSection(String message, String trackSectionID) {
        super(message);
        this.trackSectionID = trackSectionID;
    }
}
