package fr.sncf.osrd.util;

import java.util.*;
import java.util.function.DoubleUnaryOperator;

/**
 * A flat collection of elements, sorted by position.
 * @param <E> The type of the attributes
 */
public abstract class SortedSequence<E> {
    /** Iterate forward on a slice, from start (included) to end (excluded). */
    public static class SliceIterator<E> implements PeekableIterator<ValuedPoint<E>> {
        private final ArrayList<ValuedPoint<E>> data;
        private final DoubleUnaryOperator translator;
        private final int end;
        private int i;

        public SliceIterator(SortedSequence<E> seq, int start, int end, DoubleUnaryOperator translator) {
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
        public ValuedPoint<E> peek() {
            if (i >= end)
                throw new NoSuchElementException();

            var res = data.get(i);
            return new ValuedPoint<E>(translator.applyAsDouble(res.position), res.value);
        }

        @Override
        public void skip() {
            i++;
        }
    }

    /** Iterate backward on a slice, from end (excluded) to start (included). */
    public static class ReverseSliceIterator<E> implements PeekableIterator<ValuedPoint<E>> {
        private final ArrayList<ValuedPoint<E>> data;
        private final DoubleUnaryOperator translator;
        private final int start;
        private int i;

        public ReverseSliceIterator(SortedSequence<E> seq, int start, int end, DoubleUnaryOperator translator) {
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
        public ValuedPoint<E> peek() {
            if (i < start)
                throw new NoSuchElementException();

            var res = data.get(i);
            return new ValuedPoint<E>(translator.applyAsDouble(res.position), res.value);
        }

        @Override
        public void skip() {
            i--;
        }
    }

    protected ArrayList<ValuedPoint<E>> data = new ArrayList<>();

    protected void add(double position, E value) {
        assert data.isEmpty() || position >= data.get(data.size() - 1).position;
        data.add(new ValuedPoint<E>(position, value));
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
