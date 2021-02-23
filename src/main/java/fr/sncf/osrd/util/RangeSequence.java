package fr.sncf.osrd.util;

import static fr.sncf.osrd.util.RangeSequence.MinLimitBuilder.BuilderIterEvent.Type.RANGE_END;
import static fr.sncf.osrd.util.RangeSequence.MinLimitBuilder.BuilderIterEvent.Type.RANGE_START;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.util.graph.EdgeDirection;

import java.util.*;
import java.util.function.DoubleUnaryOperator;

/**
 * A sequence of points encoding a continuous stair of values.
 * It can also be described as a continuous disjoint sequence of ranges.
 *
 * <pre>
 *  {@code
 *  The following ranges:
 *
 *  from 0 to 6, the value is 0
 *  from 6 to +inf, the value is 1
 *
 *  will be encoded using two pairs:
 *   (0, 0)
 *   (6, 1)
 *
 *   value
 *     |
 *    1|          X-------
 *     |
 *    0|X----------
 *     +----------------------- position
 *      0 1 2 3 4 5 6 ...
 *  }
 * </pre>
 * @param <E> The type of the values
 */
public class RangeSequence<E> extends SortedSequence<E> {
    /** Get the end position of the step at index i. */
    double getEnd(int i) {
        double nextPosition = Double.POSITIVE_INFINITY;
        if (i < data.size() - 1)
            nextPosition = data.get(i + 1).position;
        return nextPosition;
    }

    /**
     * Get the range at index i
     * @param i the index of the range
     * @return the range at index i
     */
    public RangeValue<E> get(int i) {
        var currentPoint = data.get(i);
        return new RangeValue<>(
                currentPoint.position,
                getEnd(i),
                currentPoint.value);
    }

    /**
     * Gets the range at index i, clamped by minClamp and maxClamp, and transformed by transform
     * @param transform the translation function to apply after clamping
     * @param minClamp the min clamp
     * @param maxClamp the max clamp
     * @param i the range index
     * @return a clamped and transformed range
     */
    public RangeValue<E> getClampedTransformed(
            EdgeDirection direction,
            DoubleUnaryOperator transform,
            double minClamp,
            double maxClamp,
            int i
    ) {
        // TODO: /!\ must be kind of kept in sync with DoubleOrientedRangeSequence.getClampedTransformed /!\
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

        if (direction == EdgeDirection.START_TO_STOP)
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

        private SliceIterator(
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

            return seq.getClampedTransformed(EdgeDirection.START_TO_STOP, transform, minClamp, maxClamp, i);
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

        private ReverseSliceIterator(
                RangeSequence<E> seq,
                int start,
                int end,
                DoubleUnaryOperator transform,
                double minClamp,
                double maxClamp
        ) {
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

            return seq.getClampedTransformed(EdgeDirection.STOP_TO_START, transform, minClamp, maxClamp, i);
        }

        @Override
        public void skip() {
            i--;
        }
    }

    /**
     * Iterate on this sequence from trackIterStartPos to trackIterEndPos.
     * Translate the position of the results using the translator function.
     * @param direction whether to iterate forward or backward on the slice.
     * @param trackIterStartPos the included start position
     * @param trackIterEndPos the included end position
     * @param translator the function to use to translate the coordinates of the result
     * @return an iterator on the slice's content
     */
    public Iterator<RangeValue<E>> iterate(
            EdgeDirection direction,
            double trackIterStartPos,
            double trackIterEndPos,
            DoubleUnaryOperator translator
    ) {
        int end = data.size();
        if (direction == EdgeDirection.START_TO_STOP)
            return forwardIter(
                    0,
                    end,
                    trackIterStartPos,
                    trackIterEndPos,
                    translator);
        return backwardIter(
                0,
                end,
                trackIterEndPos,
                trackIterStartPos,
                translator);
    }

    private Iterator<RangeValue<E>> forwardIter(
            int start,
            int end,
            double iterStartPos,
            double iterEndPos,
            DoubleUnaryOperator translator
    ) {
        return new SliceIterator<E>(
                this,
                findStartIndex(start, end, iterStartPos),
                findEndIndex(start, end, iterEndPos),
                translator,
                iterStartPos,
                iterEndPos);
    }

    private PeekableIterator<RangeValue<E>> backwardIter(
            int start,
            int end,
            double iterStartPos,
            double iterEndPos,
            DoubleUnaryOperator translator
    ) {
        return new ReverseSliceIterator<E>(
                this,
                findStartIndex(start, end, iterStartPos),
                findEndIndex(start, end, iterEndPos),
                translator,
                iterStartPos,
                iterEndPos);
    }

    @Override
    @SuppressFBWarnings(
            value = "FE_FLOATING_POINT_EQUALITY",
            justification = "we're actually testing an edge case we need to test FP equality"
    )
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
        // TODO: add an epsilon?
        // if the point starts a new range at this spot, everything is fine
        if (basePoint.position == iterStartPos)
            return baseIndex;
        return baseIndex - 1;
    }

    /**
     * Find the index <b>after</b> the last range containing iterEndPos.
     */
    @Override
    @SuppressFBWarnings(
            value = "FE_FLOATING_POINT_EQUALITY",
            justification = "we're actually testing an edge case we need to test FP equality"
    )
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
        // TODO: add an epsilon?
        // remove the last range if it starts where the endPos is
        if (lastItem.position == iterEndPos)
            return baseIndex - 1;
        return baseIndex;
    }

    public static final class Builder<E> {
        private final RangeSequence<E> res;
        private final SortedMap<Range, E> data = new TreeMap<>();

        public Builder(RangeSequence<E> res) {
            this.res = res;
        }

        /**
         * Add a new range to the builder.
         * There must be no other range starting at this index.
         * @param begin the start position of the range.
         * @param end the end position of the range.
         * @param value the value for this range
         */
        public void add(double begin, double end, E value) {
            var previousValue = data.put(new Range(begin, end), value);
            // TODO: find a better way to signal this
            assert previousValue == null : "duplicate RangeSequence start bounds";
        }

        /**
         * Flush the content of the builder into the RangeSequence.
         */
        public void build() throws InvalidInfraException {
            double previousRightBound = 0;
            for (var mapEntry : data.entrySet()) {
                var range = mapEntry.getKey();
                if (FloatCompare.eq(range.begin, previousRightBound)) {
                    res.add(range.begin, mapEntry.getValue());
                } else if (range.begin < previousRightBound) {
                    throw new InvalidInfraException("overlapping ranges");
                } else {
                    res.add(previousRightBound, null);
                    res.add(range.begin, mapEntry.getValue());
                }
                previousRightBound = range.end;
            }
            res.add(previousRightBound, null);
            data.clear();
        }
    }


    /**
     * A Builder which handles overlapping ranges.
     * It needs to select the active range when multiple ones overlap.
     * @param <E> the type of the sequence elements
     */
    public static final class MinLimitBuilder<E> {
        /**
         * As we iterate over the builder's ranges, some new ones become active and some other end.
         * This class corresponds to one of these events.
         * @param <E> a value type associated with the BuilderIterEvent
         */
        static final class BuilderIterEvent<E> implements Comparable<BuilderIterEvent<?>> {
            BuilderIterEvent(
                    Type type,
                    double position,
                    long sequence,
                    E limit
            ) {
                this.type = type;
                this.position = position;
                this.sequence = sequence;
                this.limit = limit;
            }

            enum Type {
                RANGE_START(0),
                RANGE_END(1),
                ;

                public final int priority;

                Type(int priority) {
                    this.priority = priority;
                }
            }

            public final Type type;
            public final double position;
            public final long sequence;
            public final E limit;

            @Override
            public int compareTo(BuilderIterEvent<?> o) {
                int res = Double.compare(this.position, o.position);
                if (res != 0)
                    return res;

                res = Integer.compare(type.priority, o.type.priority);
                if (res != 0)
                    return res;

                return Long.compare(sequence, o.sequence);
            }

            @Override
            public boolean equals(Object obj) {
                if (obj == null)
                    return false;
                if (obj.getClass() != BuilderIterEvent.class)
                    return false;
                return compareTo((BuilderIterEvent<?>) obj) == 0;
            }

            @Override
            public int hashCode() {
                return Objects.hash(position, type, sequence);
            }
        }

        private final RangeSequence<E> res;
        private final SortedSet<BuilderIterEvent<E>> events = new TreeSet<>();
        private long sequence = 0;

        long nextSequence() {
            var res = sequence;
            sequence++;
            return res;
        }

        public MinLimitBuilder(RangeSequence<E> res) {
            this.res = res;
        }

        /**
         * Add a new range to the builder.
         * There must be no other range starting at this index.
         * @param begin the start position of the range.
         * @param end the end position of the range.
         * @param value the value for this range
         */
        public void add(double begin, double end, E value) {
            events.add(new BuilderIterEvent<>(RANGE_START, begin, nextSequence(), value));
            events.add(new BuilderIterEvent<>(RANGE_END, end, nextSequence(), value));
        }

        /**
         * Flush the content of the builder into the RangeSequence.
         */
        public void build(Comparator<E> rangeSelector) throws InvalidInfraException {
            // the last active limit
            E lastLimit = null;

            // the list of active limits, the integer being how many times over it's active
            var activeLimits = new TreeMap<E, Integer>(rangeSelector);

            // for each start or end of range
            for (var iter = events.iterator(); iter.hasNext(); ) {
                var event = iter.next();

                // modify the active limits
                if (event.type == RANGE_START) {
                    var activeCount = activeLimits.getOrDefault(event.limit, 0);
                    activeLimits.put(event.limit, activeCount + 1);
                } else {
                    int activeCount = activeLimits.get(event.limit) - 1;
                    if (activeCount == 0)
                        activeLimits.remove(event.limit);
                    else
                        activeLimits.put(event.limit, activeCount);
                }

                // consider registering a limit change
                {
                    // if we have no active limits, we should be at the end of the edge
                    if (activeLimits.isEmpty()) {
                        if (iter.hasNext())
                            throw new InvalidInfraException("missing speed limit");
                        break;
                    }

                    // get the current minimum limit
                    var currentLimit = activeLimits.firstKey();

                    // if this limit is the same as the previous one, no need to register anything
                    if (currentLimit.equals(lastLimit))
                        continue;

                    // otherwise, register a limit change
                    res.add(event.position, currentLimit);
                    lastLimit = currentLimit;
                }
            }
            events.clear();
        }
    }

    public Builder<E> builder() {
        return new Builder<E>(this);
    }

    public MinLimitBuilder<E> minLimitBuilder() {
        return new MinLimitBuilder<E>(this);
    }
}