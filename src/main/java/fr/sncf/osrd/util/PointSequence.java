package fr.sncf.osrd.util;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.NoSuchElementException;
import java.util.function.DoubleUnaryOperator;

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

        public Iterator<Entry> forwardIter(
                double iterStartPos,
                double iterEndPos,
                DoubleUnaryOperator translator,
                double excludedPosition
        ) {
            var iterEnd = end;
            while (iterEnd > start && parentSequence.data.get(iterEnd - 1).position == excludedPosition)
                iterEnd--;

            return new SliceIterator(
                    parentSequence,
                    parentSequence.findStartIndex(start, iterEnd, iterStartPos),
                    parentSequence.findEndIndex(start, iterEnd, iterEndPos),
                    translator);
        }

        public Iterator<Entry> backwardIter(
                double iterStartPos,
                double iterEndPos,
                DoubleUnaryOperator translator,
                double excludedPosition
        ) {
            var iterStart = start;
            while (iterStart < end && parentSequence.data.get(iterStart).position == excludedPosition)
                iterStart++;

            return new ReverseSliceIterator(
                    parentSequence,
                    parentSequence.findStartIndex(start, end, iterStartPos),
                    parentSequence.findEndIndex(start, end, iterEndPos),
                    translator);
        }
    }

    /**
     * Gets a slice of a sequence.
     * @param startPosition the included start slice bound
     * @param endPosition the included end slice bound
     * @return a PointSequence slice
     */
    public Slice slice(double startPosition, double endPosition) {
        var start = findStartIndex(0, data.size(), startPosition);
        var end = findStartIndex(0, data.size(), endPosition);
        return new Slice(this, start, end);
    }
}
