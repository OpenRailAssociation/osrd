package fr.sncf.osrd.utils;

import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.function.DoubleUnaryOperator;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

/**
 * A sequence of points, indexed by position.
 * @param <E> The type of the point objects
 */
public final class PointSequence<E> extends SortedSequence<E> implements Iterable<PointValue<E>> {
    public PointValue<E> get(int i) {
        return data.get(i);
    }

    /**
     * Iterate on this sequence from edgeIterStartPos to edgeIterEndPos.
     * Translate the position of the results using the translator function.
     * @param direction whether to iterate forward or backward on the slice.
     * @param edgeIterStartPos the included start position
     * @param edgeIterEndPos the included end position
     * @param translator a translation function for the coordinates of the result
     * @return an iterator on the slice's content
     */
    public PeekableIterator<PointValue<E>> iterate(
            EdgeDirection direction,
            double edgeIterStartPos,
            double edgeIterEndPos,
            DoubleUnaryOperator translator
    ) {
        return iterate(direction, 0, data.size(), edgeIterStartPos, edgeIterEndPos, translator);
    }

    /**
     * Iterate on a slice from indexes start to end, from position edgeIterStartPos to edgeIterEndPos.
     * Translate the position of the results using the translator function.
     * @param direction whether to iterate forward or backward on the slice.
     * @param start the included start index
     * @param end the excluded end index
     * @param edgeIterStartPos the included start position
     * @param edgeIterEndPos the included end position
     * @param translator a translation function for the coordinates of the result
     * @return an iterator on the slice's content
     */
    public PeekableIterator<PointValue<E>> iterate(
            EdgeDirection direction,
            int start,
            int end,
            double edgeIterStartPos,
            double edgeIterEndPos,
            DoubleUnaryOperator translator
    ) {
        if (direction == EdgeDirection.START_TO_STOP)
            return forwardIter(start, end, edgeIterStartPos, edgeIterEndPos, translator);
        return backwardIter(start, end, edgeIterEndPos, edgeIterStartPos, translator);
    }

    private PeekableIterator<PointValue<E>> forwardIter(
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
                translator);
    }

    private PeekableIterator<PointValue<E>> backwardIter(
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
                translator);
    }

    @Override
    public Iterator<PointValue<E>> iterator() {
        return data.iterator();
    }

    public static final class Builder<E> {
        private final PointSequence<E> res;
        private final SortedMap<Double, ArrayList<E>> data = new TreeMap<>();

        private Builder(PointSequence<E> res) {
            this.res = res;
        }

        /**
         * Add a new element to the builder.
         * @param position the location of the element.
         * @param value the value of the element
         */
        public void add(double position, E value) {
            var valueList = data.getOrDefault(position, null);
            if (valueList == null) {
                valueList = new ArrayList<>();
                data.put(position, valueList);
            }

            valueList.add(value);
        }

        /**
         * Flush the content of the builder into the PointSequence.
         */
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
        assert data.isEmpty();
        return new Builder<E>(this);
    }

    public Stream<PointValue<E>> stream() {
        return StreamSupport.stream(spliterator(), false);
    }
}
