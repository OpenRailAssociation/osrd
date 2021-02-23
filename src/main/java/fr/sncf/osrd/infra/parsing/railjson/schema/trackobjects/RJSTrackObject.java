package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.util.graph.ApplicableDirections;

/** An object on a RJSTrackSection. It's meant to be referenced from the section itself. */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSTrackObject {
    /** Position from the beginning of the RJSTrackSection */
    public final double position;

    /** What sides the object can be approached from */
    public abstract ApplicableDirections getNavigability();

    RJSTrackObject(double position) {
        this.position = position;
    }
}
