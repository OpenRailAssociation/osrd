package fr.sncf.osrd.util;

import java.util.ArrayList;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * A flat collection of elements, sorted by position.
 * @param <E> The type of the attributes
 */
public abstract class SortedSequence<E> {
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
}
