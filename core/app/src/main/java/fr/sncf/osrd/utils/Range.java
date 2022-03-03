package fr.sncf.osrd.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Objects;

public class Range implements Comparable<Range> {
    protected double begin;

    protected double end;

    /**
     * Creates a range
     * @param begin the start bound
     * @param end the end bound
     */
    public Range(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }

    public double getBeginPosition() {
        return begin;
    }

    public double getEndPosition() {
        return end;
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

    public double length() {
        return Math.abs(end - begin);
    }

    /** Check if a position is contained in the range */
    public boolean containsPosition(double position) {
        if (Double.min(begin, end) > position)
            return false;
        return Double.max(begin, end) >= position;
    }
}
