package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

/** An object on a RJSTrackSection. It's meant to be referenced from the section itself. */
@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSTrackObject {
    /** Position from the beginning of the RJSTrackSection */
    public double position;
    public String track;
}
