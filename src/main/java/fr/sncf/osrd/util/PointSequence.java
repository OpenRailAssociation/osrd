package fr.sncf.osrd.util;

/**
 * A sequence of points, indexed by position.
 * @param <E> The type of the point objects
 */
public final class PointSequence<E> extends SortedSequence<E> {
    /** A slice of a PointSequence. */
    public final class Slice {
        public final PointSequence<E> parentSequence;

        /** Included start bound. */
        public final int start;

        /** Excluded end bound. */
        public final int end;

        public Slice(PointSequence<E> parentSequence, int start, int end) {
            this.parentSequence = parentSequence;
            this.start = start;
            this.end = end;
        }
    }

    /**
     * Gets a slice of a sequence.
     * @param startPosition the included start slice bound
     * @param endPosition the included end slice bound
     * @return a PointSequence slice
     */
    public Slice slice(double startPosition, double endPosition) {
        int start = 0;
        for (; start < data.size(); start++)
            if (data.get(start).position >= startPosition)
                break;

        int end = start;
        for (; end < data.size(); end++)
            if (data.get(end).position > endPosition)
                break;

        return new Slice(this, start, end);
    }
}
