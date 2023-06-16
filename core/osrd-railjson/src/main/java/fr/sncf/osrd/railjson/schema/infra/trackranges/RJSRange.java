package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Objects;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRange {
    /** Positions from the beginning of the RJSTrackSection */
    public double begin;
    public double end;

    public RJSRange(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSRange rjsRange)) return false;
        return Double.compare(rjsRange.begin, begin) == 0 && Double.compare(rjsRange.end, end) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(begin, end);
    }
}
