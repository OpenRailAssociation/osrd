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

    public final class Cursor {
        private int currentIndex = 0;
        private PointSequence<E> seq;

        public Cursor(PointSequence<E> seq) {
            this.seq = seq;
        }

        /**
         * Returns the next point, and moves the iterator forward.
         * @return the next point in the sequence
         */
        public Entry next() {
            var data = this.seq.data;
            if (currentIndex >= data.size())
                return null;

            var res = data.get(currentIndex);
            currentIndex++;
            return res;
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

    public Cursor cursor() {
        return new Cursor(this);
    }
}
