package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import java.util.Comparator;
import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSTrackRange {
    /** Positions from the beginning of the RJSTrackSection */
    public double begin;
    public double end;

    /** What sides the object can be approached from */
    public abstract ApplicableDirection getNavigability();

    RJSTrackRange(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }

    /** Check whether a list of track ranges is overlaping */
    public static boolean isOverlaping(List<? extends RJSTrackRange> ranges) {
        ranges.sort(Comparator.comparing(e -> e.begin));
        for (var i = 0; i < ranges.size() - 1; i++) {
            if (ranges.get(i).end > ranges.get(i + 1).begin)
                return true;
        }
        return false;
    }
}
