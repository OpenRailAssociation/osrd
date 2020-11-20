package fr.sncf.osrd.util;

import java.util.Iterator;

/**
 * A sequence of points encoding a continuous stair of values.
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
public final class StairSequence<E> extends SortedSequence<E> {
    /** Get the end position of the step at index i. */
    double getEnd(int i) {
        double nextPosition = Double.POSITIVE_INFINITY;
        if (i < data.size() - 1)
            nextPosition = data.get(i + 1).position;
        return nextPosition;
    }

    public ValuedRange<E> get(int i) {
        var currentPoint = data.get(i);
        return new ValuedRange<>(
                currentPoint.position,
                getEnd(i),
                currentPoint.value);
    }

    public ValuedRange<E> getClampedOffset(double offset, double lowBound, double highBound, int i) {
        var currentPoint = data.get(i);

        var startPos = currentPoint.position;
        var endPos = getEnd(i);

        // clamp
        if (startPos < lowBound)
            startPos = lowBound;
        if (endPos > highBound)
            endPos = highBound;

        return new ValuedRange<>(
                startPos + offset,
                endPos + offset,
                currentPoint.value);
    }

    /** A slice of a StairSequence. */
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
     * Gets a slice of a StairSequence.
     * @param startPosition the included start slice bound
     * @param endPosition the included end slice bound
     * @return a StairSequence slice
     */
    public Slice slice(double startPosition, double endPosition) {
        var startIndex = findStartIndex(0, data.size(), startPosition);
        var endIndex = findEndIndex(0, data.size(), endPosition);
        return new Slice(this, startIndex, endIndex);
    }
}