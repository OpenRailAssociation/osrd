package fr.sncf.osrd.utils;

import java.util.HashMap;
import java.util.Map;
import java.util.function.BiFunction;
import java.util.function.Function;

public class CryoMap<K, V> extends HashMap<K, V> implements Freezable {
    private static final long serialVersionUID = 7417733629718868505L;

    private boolean frozen = false;

    public CryoMap(int initialCapacity, float loadFactor) {
        super(initialCapacity, loadFactor);
    }

    public CryoMap(int initialCapacity) {
        super(initialCapacity);
    }

    public CryoMap() {
        super();
    }

    public CryoMap(Map<? extends K, ? extends V> m) {
        super(m);
    }

    @Override
    public void freeze() {
        assert !frozen;
        frozen = true;
    }

    @Override
    public boolean isFrozen() {
        return frozen;
    }

    static final String FROZEN_MSG = "Frozen CryoMap";

    @Override
    public void clear() {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        super.clear();
    }

    @Override
    public V put(K key, V value) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.put(key, value);
    }

    @Override
    public void putAll(Map<? extends K, ? extends V> m) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        super.putAll(m);
    }

    @Override
    public V remove(Object key) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.remove(key);
    }

    @Override
    public boolean remove(Object key, Object value) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.remove(key, value);
    }

    @Override
    public V putIfAbsent(K key, V value) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.putIfAbsent(key, value);
    }

    @Override
    public boolean replace(K key, V oldValue, V newValue) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.replace(key, oldValue, newValue);
    }

    @Override
    public V replace(K key, V value) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.replace(key, value);
    }

    @Override
    public V computeIfAbsent(K key, Function<? super K, ? extends V> mappingFunction) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.computeIfAbsent(key, mappingFunction);
    }

    @Override
    public V computeIfPresent(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.computeIfPresent(key, remappingFunction);
    }

    @Override
    public V compute(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.compute(key, remappingFunction);
    }

    @Override
    public V merge(K key, V value, BiFunction<? super V, ? super V, ? extends V> remappingFunction) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.merge(key, value, remappingFunction);
    }

    @Override
    public void replaceAll(BiFunction<? super K, ? super V, ? extends V> function) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        super.replaceAll(function);
    }
}
