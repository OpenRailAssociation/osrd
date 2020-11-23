package fr.sncf.osrd.util;

import fr.sncf.osrd.infra.graph.EdgeDirection;

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

        public PeekableIterator<Entry> iterate(
                EdgeDirection direction,
                double iterStartPos,
                double iterEndPos,
                DoubleUnaryOperator translator
        ) {
            if (direction == EdgeDirection.START_TO_STOP)
                return forwardIter(iterStartPos, iterEndPos, translator);
            return backwardIter(iterEndPos, iterStartPos, translator);
        }

        public PeekableIterator<Entry> forwardIter(
                double iterStartPos,
                double iterEndPos,
                DoubleUnaryOperator translator
        ) {
            return new SliceIterator(
                    parentSequence,
                    parentSequence.findStartIndex(start, end, iterStartPos),
                    parentSequence.findEndIndex(start, end, iterEndPos),
                    translator);
        }

        public PeekableIterator<Entry> backwardIter(
                double iterStartPos,
                double iterEndPos,
                DoubleUnaryOperator translator
        ) {
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
        var end = findEndIndex(0, data.size(), endPosition);
        return new Slice(this, start, end);
    }
}
