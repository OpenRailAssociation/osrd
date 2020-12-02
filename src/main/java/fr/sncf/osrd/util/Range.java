package fr.sncf.osrd.util;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Objects;

public class Range implements Comparable<Range> {
    public final double begin;
    public final double end;

    public Range(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }

    @Override
    public int hashCode() {
        return Objects.hash(begin, end);
    }

    @SuppressFBWarnings(
            value = "FE_FLOATING_POINT_EQUALITY",
            justification = "we need strict equality if we want to work with hash tables"
    )
    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (this.getClass() != obj.getClass())
            return false;

        var o = (Range) obj;
        return begin == o.begin && end == o.end;
    }

    @Override
    public int compareTo(Range other) {
        int compare = Double.compare(begin, other.begin);
        if (compare == 0)
            return Double.compare(end, other.end);
        return compare;
    }
}
