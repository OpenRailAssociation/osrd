package fr.sncf.osrd.util;

/**
 * A map data structure for indexable objects.
 * @param <K> The type of key objects.
 * @param <V> The type of the stored values.
 */
public class CryoFlatMap<K extends Indexable, V> extends CryoList<V> {
    private static final long serialVersionUID = -6263343647673638790L;

    /**
     * Sets the value associated with some indexable object.
     * @param key the key object
     * @param value the value
     */
    public V put(K key, V value) {
        var index = key.getIndex();
        if (index >= size()) {
            while (index > size())
                add(null);
            add(value);
            return null;
        } else {
            var previous = get(index);
            set(index, value);
            return previous;
        }
    }

    /**
     * Gets the value associated with the given indexable key
     * @param key the key to get the associated value of
     * @return the value associated to key
     */
    public V get(K key) {
        var index = key.getIndex();
        var value = get(index);
        if (value == null)
            throw new IndexOutOfBoundsException();
        return value;
    }
}
