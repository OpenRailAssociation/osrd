package fr.sncf.osrd.util;

import java.util.*;
import java.util.function.DoubleUnaryOperator;

/**
 * A flat collection of elements, sorted by position.
 * @param <E> The type of the attributes
 */
public abstract class SortedSequence<E> {
    /** Iterate forward on a slice, from start (included) to end (excluded). */
    public class SliceIterator implements Iterator<Entry> {
        private final ArrayList<Entry> data;
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
        public Entry next() {
            if (i >= end)
                throw new NoSuchElementException();

            var res = data.get(i);
            i++;
            return new Entry(translator.applyAsDouble(res.position), res.value);
        }
    }

    /** Iterate backward on a slice, from end (excluded) to start (included). */
    public class ReverseSliceIterator implements Iterator<Entry> {
        private final ArrayList<Entry> data;
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
        public Entry next() {
            if (i < start)
                throw new NoSuchElementException();

            var res = data.get(i);
            i--;
            return new Entry(translator.applyAsDouble(res.position), res.value);
        }
    }

    public class Entry {
        public final double position;
        public final E value;

        public Entry(double position, E value) {
            this.position = position;
            this.value = value;
        }
    }

    public final class Builder {
        SortedMap<Double, E> data = new TreeMap<>();

        public void add(double position, E e) {
            data.put(position, e);
        }

        public void build(SortedSequence<E> res) {
            for (Map.Entry<Double, E> item : data.entrySet())
                res.add(item.getKey(), item.getValue());
        }
    }

    protected ArrayList<Entry> data = new ArrayList<>();

    private void add(double position, E value) {
        assert data.isEmpty() || position >= data.get(data.size() - 1).position;
        data.add(new Entry(position, value));
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
