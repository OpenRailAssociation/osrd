package fr.sncf.osrd.infra.railjson.schema.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSTrackRange {
    /** Positions from the beginning of the RJSTrackSection */
    public final double begin;
    public final double end;

    /** What sides the object can be approached from */
    public abstract ApplicableDirections getNavigability();

    RJSTrackRange(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }
}
