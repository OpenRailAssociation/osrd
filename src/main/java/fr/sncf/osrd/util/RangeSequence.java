package fr.sncf.osrd.util;

import fr.sncf.osrd.infra.graph.EdgeDirection;

import java.util.*;
import java.util.function.DoubleUnaryOperator;

/**
 * A sequence of points encoding a continuous stair of values.
 * It can also be described as a continuous disjoint sequence of ranges.
 *
 * <pre>
 *  {@code
 *   value
 *     |
 *     |          X-------
 *     |
 *     |  X--------
 *     +----------------------- position
 *  }
 * </pre>
 * @param <E> The type of the values
 */
public final class RangeSequence<E> extends SortedSequence<E> {
    /** Get the end position of the step at index i. */
    double getEnd(int i) {
        double nextPosition = Double.POSITIVE_INFINITY;
        if (i < data.size() - 1)
            nextPosition = data.get(i + 1).position;
        return nextPosition;
    }

    public RangeValue<E> get(int i) {
        var currentPoint = data.get(i);
        return new RangeValue<>(
                currentPoint.position,
                getEnd(i),
                currentPoint.value);
    }

    public RangeValue<E> getClampedTransformed(DoubleUnaryOperator transform, double minClamp, double maxClamp, int i) {
        var currentPoint = data.get(i);

        var startPos = currentPoint.position;
        var endPos = getEnd(i);

        // clamp
        if (startPos < minClamp)
            startPos = minClamp;
        if (endPos > maxClamp)
            endPos = maxClamp;

        var trStartPos = transform.applyAsDouble(startPos);
        var trEndPos = transform.applyAsDouble(endPos);

        if (trStartPos < trEndPos)
            return new RangeValue<>(trStartPos, trEndPos, currentPoint.value);
        return new RangeValue<>(trEndPos, trStartPos, currentPoint.value);
    }

    /** Iterate forward on a slice, from start (included) to end (excluded). */
    public static class SliceIterator<E> implements PeekableIterator<RangeValue<E>> {
        private final RangeSequence<E> seq;
        private final DoubleUnaryOperator transform;
        private final double minClamp;
        private final double maxClamp;
        private final int end;
        private int i;

        public SliceIterator(
                RangeSequence<E> seq,
                int start,
                int end,
                DoubleUnaryOperator transform,
                double minClamp,
                double maxClamp
        ) {
            this.seq = seq;
            this.transform = transform;
            this.end = end;
            this.i = start;
            this.minClamp = minClamp;
            this.maxClamp = maxClamp;
        }

        @Override
        public boolean hasNext() {
            return i < end;
        }

        @Override
        public RangeValue<E> peek() {
            if (i >= end)
                throw new NoSuchElementException();

            return seq.getClampedTransformed(transform, minClamp, maxClamp, i);
        }

        @Override
        public void skip() {
            i++;
        }
    }

    /** Iterate backward on a slice, from end (excluded) to start (included). */
    public static class ReverseSliceIterator<E> implements PeekableIterator<RangeValue<E>> {
        private final RangeSequence<E> seq;
        private final DoubleUnaryOperator transform;
        private final double minClamp;
        private final double maxClamp;
        private final int start;
        private int i;

        public ReverseSliceIterator(RangeSequence<E> seq, int start, int end, DoubleUnaryOperator transform, double minClamp, double maxClamp) {
            this.seq = seq;
            this.transform = transform;
            this.start = start;
            this.i = end - 1;
            this.minClamp = minClamp;
            this.maxClamp = maxClamp;
        }

        @Override
        public boolean hasNext() {
            return i >= start;
        }

        @Override
        public RangeValue<E> peek() {
            if (i < start)
                throw new NoSuchElementException();

            return seq.getClampedTransformed(transform, minClamp, maxClamp, i);
        }

        @Override
        public void skip() {
            i--;
        }
    }


    /** A slice of a RangeSequence. */
    public static final class Slice<E> {
        public final RangeSequence<E> parentSequence;

        /** Included start bound. */
        public final int start;

        /** Excluded end bound. */
        public final int end;

        public Slice(RangeSequence<E> parentSequence, int start, int end) {
            this.parentSequence = parentSequence;
            this.start = start;
            this.end = end;
        }

        public Iterator<RangeValue<E>> iterate(EdgeDirection direction,
                                               double trackIterStartPos,
                                               double trackIterEndPos,
                                               DoubleUnaryOperator trackOffsetConverter
        ) {
            if (direction == EdgeDirection.START_TO_STOP)
                return forwardIter(
                        trackIterStartPos,
                        trackIterEndPos,
                        trackOffsetConverter);
            return backwardIter(
                    trackIterEndPos,
                    trackIterStartPos,
                    trackOffsetConverter);
        }

        public Iterator<RangeValue<E>> forwardIter(
                double iterStartPos,
                double iterEndPos,
                DoubleUnaryOperator translator
        ) {
            return new SliceIterator(
                    parentSequence,
                    parentSequence.findStartIndex(start, end, iterStartPos),
                    parentSequence.findEndIndex(start, end, iterEndPos),
                    translator,
                    iterStartPos,
                    iterEndPos);
        }

        public PeekableIterator<RangeValue<E>> backwardIter(
                double iterStartPos,
                double iterEndPos,
                DoubleUnaryOperator translator
        ) {
            return new ReverseSliceIterator(
                    parentSequence,
                    parentSequence.findStartIndex(start, end, iterStartPos),
                    parentSequence.findEndIndex(start, end, iterEndPos),
                    translator,
                    iterStartPos,
                    iterEndPos);
        }
    }

    @Override
    public int findStartIndex(int start, int end, double iterStartPos) {
        // we need to do a fixup, as the sorted sequence's findStartIndex looks for
        // the index of the first point with a position after or on iterStartPos.
        // however, as a stair sequence encodes ranges, we may need the previous point as well
        var baseIndex = super.findStartIndex(start, end, iterStartPos);
        if (baseIndex == 0)
            return baseIndex;

        // if there's no point on or after iterStartPos, we need the open range at the end
        if (baseIndex == data.size())
            return data.size() - 1;

        var basePoint = data.get(baseIndex);
        // TODO: add an epsilon
        // if the point starts a new range at this spot, everything is fine
        if (basePoint.position == iterStartPos)
            return baseIndex;
        return baseIndex - 1;
    }

    /**
     * Find the index <b>after</b> the last range containing iterEndPos.
     */
    @Override
    public int findEndIndex(int start, int end, double iterEndPos) {
        // finds the index <b>after</b> the last element with a position below or on iterEndPos,
        // in terms of ranges, it means the index after the range start
        // by we need to find the index after the last range below or including iterEndPos
        var baseIndex = super.findEndIndex(start, end, iterEndPos);
        //         2
        //   1     X-----
        //   X-----   ^ for this endPos, the last elem is 2
        //         ^ for this endPos, the last elem is 1 (we don't want empty ranges)
        if (baseIndex == 0)
            return baseIndex;

        var lastItem = data.get(baseIndex - 1);
        // TODO: add an epsilon
        // remove the last range if it starts where the endPos is
        if (lastItem.position == iterEndPos)
            return baseIndex - 1;
        return baseIndex;
    }

    /**
     * Gets a slice of a RangeSequence.
     * @param startPosition the included start slice bound
     * @param endPosition the included end slice bound
     * @return a RangeSequence slice
     */
    public Slice<E> slice(double startPosition, double endPosition) {
        var startIndex = findStartIndex(0, data.size(), startPosition);
        var endIndex = findEndIndex(0, data.size(), endPosition);
        return new Slice<E>(this, startIndex, endIndex);
    }

    public static final class Builder<E> {
        private final RangeSequence<E> res;
        private final SortedMap<Double, E> data = new TreeMap<>();

        public Builder(RangeSequence<E> res) {
            this.res = res;
        }

        public void add(double position, E e) {
            var previousValue = data.put(position, e);
            // TODO: find a better way to signal this
            assert previousValue == null : "duplicate RangeSequence start bounds";
        }

        public void build() {
            for (var mapEntry : data.entrySet()) {
                var position = mapEntry.getKey();
                res.add(position, mapEntry.getValue());
            }
            data.clear();
        }
    }

    public Builder<E> builder() {
        return new Builder<E>(this);
    }
}