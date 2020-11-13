package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * A flat collection of elements, sorted by position.
 * @param <E> The type of the attributes
 */
public abstract class SortedSequence<E> {
    public final class Builder {
        SortedMap<Double, E> data = new TreeMap<>();

        public void add(double position, E e) {
            data.put(position, e);
        }

        public void build(SortedSequence<E> res) {
            for (Map.Entry<Double, E> item : data.entrySet())
                res.add(item);
        }
    }

    protected ArrayList<Map.Entry<Double, E>> data = new ArrayList<>();

    private void add(Map.Entry<Double, E> item) {
        assert data.isEmpty() || item.getKey() >= data.get(data.size() - 1).getKey();
        data.add(item);
    }
}
