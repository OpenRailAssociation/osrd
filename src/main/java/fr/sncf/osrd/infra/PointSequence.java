package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * A collection of homogeneous type 1d position indexed attributes.
 * @param <E> The type of the attributes
 */
public class PointSequence<E> {
    public class Builder {
        SortedMap<Double, E> data = new TreeMap<>();

        public void add(double position, E e) {
            data.put(position, e);
        }

        public PointSequence<E> build() {
            var res = new PointSequence<E>();
            for (Map.Entry<Double, E> item : data.entrySet())
                res.add(item);
            return res;
        }
    }

    public class CachedAccessor {
        private int lastUsedIndex = 0;
        private PointSequence<E> seq;

        public CachedAccessor(PointSequence<E> seq) {
            this.seq = seq;
        }

        /**
         * +-----+------+---+------+-----+---->
         *       ^      ^
         *  position    result
         *
         * @return the first entry after the given position
         */
        public E firstAfter(double position) {
            var data = seq.data;

            // find the spot where the right scan should start
            int searchStart = lastUsedIndex;
            while (searchStart > 0) {
                // the search must start before or at position.
                if (data.get(searchStart).getKey() <= position)
                    break;
                searchStart--;
            }

            for (int i = searchStart; i < data.size(); i++) {
                var current = data.get(i);
                if (current.getKey() > position) {
                    lastUsedIndex = i;
                    return current.getValue();
                }
            }

            return null;
        }
    }

    public CachedAccessor accessor() {
        return new CachedAccessor(this);
    }

    protected ArrayList<Map.Entry<Double, E>> data = new ArrayList<>();

    private void add(Map.Entry<Double, E> item) {
        assert data.isEmpty() || item.getKey() >= data.get(data.size() - 1).getKey();
        data.add(item);
    }
}
