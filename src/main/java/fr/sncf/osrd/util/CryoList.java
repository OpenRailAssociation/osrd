package fr.sncf.osrd.util;

import java.util.*;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;


/**
 * A List data structure that can't be modified once frozen.
 * Wraps ArrayList.
 * @param <E> Type of the list elements
 */
public final class CryoList<E> extends ArrayList<E> implements Freezable {
    boolean frozen = false;

    public CryoList() {
        super();
    }

    public CryoList(int initialSize) {
        super(initialSize);
    }

    public CryoList(Collection<? extends E> c) {
        super(c);
    }

    public void freeze() {
        frozen = true;
    }

    static final String FROZEN_MSG = "Frozen CryoList";

    @Override
    public void clear() {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        super.clear();
    }

    @Override
    public E set(int index, E element) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.set(index, element);
    }

    @Override
    public boolean add(E e) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.add(e);
    }

    @Override
    public void add(int index, E element) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        super.add(index, element);
    }

    @Override
    public E remove(int index) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.remove(index);
    }

    @Override
    public boolean remove(Object o) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.remove(o);
    }

    @Override
    public boolean addAll(Collection<? extends E> c) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.addAll(c);
    }

    @Override
    public boolean addAll(int index, Collection<? extends E> c) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.addAll(index, c);
    }

    @Override
    protected void removeRange(int fromIndex, int toIndex) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        super.removeRange(fromIndex, toIndex);
    }

    @Override
    public boolean removeAll(Collection<?> c) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.removeAll(c);
    }

    @Override
    public boolean retainAll(Collection<?> c) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.retainAll(c);
    }

    @Override
    public boolean removeIf(Predicate<? super E> filter) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.removeIf(filter);
    }

    @Override
    public void replaceAll(UnaryOperator<E> operator) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        super.replaceAll(operator);
    }

    @Override
    public void sort(Comparator<? super E> c) {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        super.sort(c);
    }

    @Override
    public ListIterator<E> listIterator() {
        if (frozen)
            throw new UnsupportedOperationException(FROZEN_MSG);
        return super.listIterator();
    }
}
