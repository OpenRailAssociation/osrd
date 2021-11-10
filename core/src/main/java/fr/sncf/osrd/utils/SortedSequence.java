package fr.sncf.osrd.utils;

import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.ArrayList;
import java.util.NoSuchElementException;
import java.util.function.DoubleUnaryOperator;

/**
 * A flat collection of elements, sorted by position.
 * @param <E> The type of the attributes
 */
public abstract class SortedSequence<E> {
    /**
     * Gets the index of the first element of this sequence, or NaN
     * @return the index of the first element of this sequence, or NaN
     */
    public double getFirstPosition() {
        if (data.size() == 0)
            return Double.NaN;
        return data.get(0).position;
    }

    /**
     * Gets the index of the first element of this sequence along dir, or NaN
     * @param dir the reference direction
     * @return the index of the first element of this sequence, or NaN
     */
    public double getFirstPosition(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return getFirstPosition();
        return getLastPosition();
    }

    /**
     * Gets the index of the last element of this sequence, or NaN
     * @return the index of the last element of this sequence, or NaN
     */
    public double getLastPosition() {
        var size = data.size();
        if (size == 0)
            return Double.NaN;
        var lastItem = data.get(size - 1);
        // null encode the absence of information, thus we need to skip it
        if (lastItem.value != null)
            return lastItem.position;
        // ensure that there is a value (except null)
        if (size == 1)
            return Double.NaN;
        return data.get(size - 2).position;
    }

    /**
     * Gets the index of the last element of this sequence along dir, or NaN
     * @param dir the reference direction
     * @return the index of the last element of this sequence, or NaN
     */
    public double getLastPosition(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return getLastPosition();
        return getFirstPosition();
    }

    /** Iterate forward on a slice, from start (included) to end (excluded). */
    public static class SliceIterator<E> implements PeekableIterator<PointValue<E>> {
        private final ArrayList<PointValue<E>> data;
        private final DoubleUnaryOperator translator;
        private final int end;
        private int i;

        protected SliceIterator(SortedSequence<E> seq, int start, int end, DoubleUnaryOperator translator) {
            this.data = seq.data;
            this.translator = translator;
            this.end = end;
            this.i = start;
        }

        @Override
        public boolean hasNext() {
            return i < end;
        }

        @Override
        public PointValue<E> peek() {
            if (i >= end)
                throw new NoSuchElementException();

            var res = data.get(i);
            var position = res.position;
            if (translator != null)
                position = translator.applyAsDouble(position);
            return new PointValue<E>(position, res.value);
        }

        @Override
        public void skip() {
            i++;
        }
    }

    /** Iterate backward on a slice, from end (excluded) to start (included). */
    public static class ReverseSliceIterator<E> implements PeekableIterator<PointValue<E>> {
        private final ArrayList<PointValue<E>> data;
        private final DoubleUnaryOperator translator;
        private final int start;
        private int i;

        protected ReverseSliceIterator(SortedSequence<E> seq, int start, int end, DoubleUnaryOperator translator) {
            this.data = seq.data;
            this.translator = translator;
            this.start = start;
            this.i = end - 1;
        }

        @Override
        public boolean hasNext() {
            return i >= start;
        }

        @Override
        public PointValue<E> peek() {
            if (i < start)
                throw new NoSuchElementException();

            var res = data.get(i);
            var position = res.position;
            if (translator != null)
                position = translator.applyAsDouble(position);
            return new PointValue<E>(position, res.value);
        }

        @Override
        public void skip() {
            i--;
        }
    }

    public final ArrayList<PointValue<E>> data = new ArrayList<>();

    protected void add(double position, E value) {
        assert data.isEmpty() || position >= data.get(data.size() - 1).position;
        data.add(new PointValue<E>(position, value));
    }

    /**
     * Finds the index of the first point with a position after or on iterStartPos.
     * @param start included lower bound or the search area
     * @param end excluded upper bound of the search area
     * @param iterStartPos start position to look for
     * @return the index of the first element after or on iterStartPos, or end if none is found.
     */
    public int findStartIndex(int start, int end, double iterStartPos) {
        int i = start;
        for (; i < end; i++)
            if (data.get(i).position >= iterStartPos)
                break;
        return i;
    }

    /**
     * Finds the index <b>after</b> the last element with a position below or on iterEndPos.
     * @param start included lower bound or the search area
     * @param end excluded upper bound of the search area
     * @param iterEndPos end position to look for
     * @return the index <b>after</b> the last element with a position below or on iterEndPos, or end if none is found.
     */
    public int findEndIndex(int start, int end, double iterEndPos) {
        int i = end;
        for (; i > start; i--)
            if (data.get(i - 1).position <= iterEndPos)
                break;
        return i;
    }
}
