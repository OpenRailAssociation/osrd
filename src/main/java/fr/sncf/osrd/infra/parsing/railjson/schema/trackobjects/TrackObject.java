package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

/** An object on a TrackSection. It's meant to be referenced from the section itself. */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class TrackObject {
    /** Position from the beginning of the TrackSection */
    public final double position;

    /** What sides the object can be approached from */
    abstract Navigability getNavigability();

    TrackObject(double position) {
        this.position = position;
    }
}
