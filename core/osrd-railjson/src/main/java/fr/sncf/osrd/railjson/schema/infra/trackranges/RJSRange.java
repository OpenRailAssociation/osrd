package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import java.util.Comparator;
import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRange {
    /** Positions from the beginning of the RJSTrackSection */
    public double begin;
    public double end;

    public RJSRange(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }
}
