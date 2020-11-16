package fr.sncf.osrd.infra;

import java.util.Map;

/**
 * A sequence of points, indexed by position.
 * @param <E> The type of the point objects
 */
public final class PointSequence<E> extends SortedSequence<E> {
    public final class Cursor {
        private int currentIndex = 0;
        private PointSequence<E> seq;

        public Cursor(PointSequence<E> seq) {
            this.seq = seq;
        }

        /**
         * Returns the next point in the sequence.
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

    public Cursor cursor() {
        return new Cursor(this);
    }
}
