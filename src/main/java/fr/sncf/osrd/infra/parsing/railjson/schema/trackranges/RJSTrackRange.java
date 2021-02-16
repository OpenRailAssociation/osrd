package fr.sncf.osrd.infra.parsing.railjson.schema.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.ApplicableDirections;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSTrackRange {
    /** Positions from the beginning of the RJSTrackSection */
    public final double begin;
    public final double end;

    /** What sides the object can be approached from */
    abstract ApplicableDirections getNavigability();

    RJSTrackRange(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }
}
