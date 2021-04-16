package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

/** An object on a RJSTrackSection. It's meant to be referenced from the section itself. */
public abstract class RJSTrackObject {
    /** Position from the beginning of the RJSTrackSection */
    public double position;

    /** What sides the object can be approached from */
    public abstract ApplicableDirections getNavigability();

    RJSTrackObject(double position) {
        this.position = position;
    }
}
