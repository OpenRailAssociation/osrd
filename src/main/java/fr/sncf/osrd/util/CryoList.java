package fr.sncf.osrd.util;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.ListIterator;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;


/**
 * A List data structure that can't be modified once frozen.
 * Wraps ArrayList.
 * @param <E> Type of the list elements
 */
@SuppressFBWarnings(
        value = "EQ_DOESNT_OVERRIDE_EQUALS",
        justification = "we're ok with being the frozen status being ignored when testing list equality"
)
public class CryoList<E> extends ArrayList<E> implements Freezable {
    private static final long serialVersionUID = 2140934581223716305L;

    private boolean frozen = false;

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

    public boolean isFrozen() {
        return frozen;
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

    public E first() {
        return get(0);
    }

    public E last() {
        return get(size() - 1);
    }
}
