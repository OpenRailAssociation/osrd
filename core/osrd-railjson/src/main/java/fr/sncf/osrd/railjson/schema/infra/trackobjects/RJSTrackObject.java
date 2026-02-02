package fr.sncf.osrd.railjson.schema.infra.trackobjects;

/** An object on a RJSTrackSection. It's meant to be referenced from the section itself. */
public abstract class RJSTrackObject {
    /** Position from the beginning of the RJSTrackSection */
    public double position;

    public String track;
}
