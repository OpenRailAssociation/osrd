package fr.sncf.osrd.util;

/**
 * A sequence of points delimiting a continuous stair.
 * @param <E> The type of the point objects
 */
public final class StairSequence<E> extends SortedSequence<E> {
    /** A slice of a PointSequence. */
    public final class Slice {
        public final StairSequence<E> parentSequence;

        /** Included start bound. */
        public final int start;

        /** Excluded end bound. */
        public final int end;

        public Slice(StairSequence<E> parentSequence, int start, int end) {
            this.parentSequence = parentSequence;
            this.start = start;
            this.end = end;
        }
    }

    public final class Cursor {
        private int currentIndex = 0;
        private StairSequence<E> seq;

        public Cursor(StairSequence<E> seq) {
            this.seq = seq;
        }

        public Entry at() {
            return this.seq.data.get(currentIndex);
        }

        public double position() {
            return at().position;
        }

        public E value() {
            return at().value;
        }

        /**
         * Moves the cursor forward until the given position is reached.
         * @param targetPosition the position to stop at
         */
        public void advanceUntil(double targetPosition) {
            assert targetPosition > position();
            var data = this.seq.data;
            while (currentIndex < data.size() - 1) {
                if (position() > targetPosition)
                    break;
                currentIndex++;
            }
        }
    }

    /**
     * Gets a slice of a StairSequence.
     * @param startPosition the included start slice bound
     * @param endPosition the included end slice bound
     * @return a StairSequence slice
     */
    public Slice slice(double startPosition, double endPosition) {
        // with a stair sequence, the start is at the last point before
        // the given start position, as it may holds the stair level at the start position
        int start = 0;
        for (int i = 0; i < data.size(); i++) {
            if (data.get(i).position >= startPosition)
                break;
            start = i;
        }

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