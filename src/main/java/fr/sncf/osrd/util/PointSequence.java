package fr.sncf.osrd.util;

import fr.sncf.osrd.infra.graph.EdgeDirection;

import java.util.*;
import java.util.function.DoubleUnaryOperator;

/**
 * A sequence of points, indexed by position.
 * @param <E> The type of the point objects
 */
public final class PointSequence<E> extends SortedSequence<E> {
    /** A slice of a PointSequence. */
    public static final class Slice<E> {
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

        public PeekableIterator<PointValue<E>> iterate(
                EdgeDirection direction,
                double iterStartPos,
                double iterEndPos,
                DoubleUnaryOperator translator
        ) {
            if (direction == EdgeDirection.START_TO_STOP)
                return forwardIter(iterStartPos, iterEndPos, translator);
            return backwardIter(iterEndPos, iterStartPos, translator);
        }

        public PeekableIterator<PointValue<E>> forwardIter(
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

        public PeekableIterator<PointValue<E>> backwardIter(
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
    public Slice<E> slice(double startPosition, double endPosition) {
        var start = findStartIndex(0, data.size(), startPosition);
        var end = findEndIndex(0, data.size(), endPosition);
        return new Slice<E>(this, start, end);
    }

    public static final class Builder<E> {
        private final PointSequence<E> res;
        private final SortedMap<Double, ArrayList<E>> data = new TreeMap<>();

        public Builder(PointSequence<E> res) {
            this.res = res;
        }

        public void add(double position, E e) {
            var valueList = data.getOrDefault(position, null);
            if (valueList == null) {
                valueList = new ArrayList<>();
                data.put(position, valueList);
            }

            valueList.add(e);
        }

        public void build() {
            for (var mapEntry : data.entrySet()) {
                var position = mapEntry.getKey();
                for (var item : mapEntry.getValue())
                    res.add(position, item);
            }
            data.clear();
        }
    }

    public Builder<E> builder() {
        return new Builder<E>(this);
    }
}
