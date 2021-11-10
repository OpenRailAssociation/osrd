package fr.sncf.osrd.utils;

import edu.umd.cs.findbugs.annotations.NonNull;
import java.util.AbstractSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;

public class SortedArraySet<E extends Comparable<E>> extends AbstractSet<E> {
    protected final ArrayList<E> data = new ArrayList<>();

    public E get(int index) {
        return data.get(index);
    }

    @Override
    @NonNull
    public Iterator<E> iterator() {
        return data.iterator();
    }

    @Override
    public int size() {
        return data.size();
    }

    @Override
    public void clear() {
        data.clear();
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof SortedArraySet))
            return false;
        return data.equals(((SortedArraySet<?>) o).data);
    }

    /** Check whether the set contains some element */
    public boolean contains(E o) {
        for (var element : data) {
            var cmpRes = element.compareTo(o);
            if (cmpRes < 0)
                continue;
            if (cmpRes == 0)
                return true;
            break;
        }
        return false;
    }

    /** Check whether the given set is a subset */
    public boolean contains(SortedArraySet<E> o) {
        var intersection = intersect(o);
        return intersection.size() == o.size();
    }

    @Override
    public int hashCode() {
        return data.hashCode();
    }

    @Override
    public boolean add(E e) {
        var indexOfE = Collections.binarySearch(data, e);
        if (indexOfE >= 0)
            return false;

        var insertionIndex = -(indexOfE + 1);
        data.add(insertionIndex, e);
        return true;
    }

    /** Computes the intersection of setA with setB , and stores the result in resultSet */
    public static <E extends Comparable<E>> void intersect(
            SortedArraySet<E> resultSet,
            SortedArraySet<E> setA,
            SortedArraySet<E> setB
    ) {
        int indexA = 0;
        int indexB = 0;

        var dataA = setA.data;
        var dataB = setB.data;
        var resData = resultSet.data;

        resData.clear();

        int lenA = dataA.size();
        int lenB = dataB.size();
        while (indexA < lenA && indexB < lenB) {
            var curSelf = dataA.get(indexA);
            var curOther = dataB.get(indexB);

            var cmpRes = curSelf.compareTo(curOther);
            if (cmpRes == 0) {
                resData.add(curSelf);
                indexA++;
                indexB++;
            } else if (cmpRes < 0)
                indexA++;
            else
                indexB++;
        }
    }

    /** Creates a new set and fills it with the intersection of this set with some otherSet. */
    public SortedArraySet<E> intersect(SortedArraySet<E> otherSet) {
        var res = new SortedArraySet<E>();
        intersect(res, this, otherSet);
        return res;
    }

    /** Computes the union of setA with setB, and stores the result in resultSet */
    public static <E extends Comparable<E>> void union(
            SortedArraySet<E> resultSet,
            SortedArraySet<E> setA,
            SortedArraySet<E> setB
    ) {
        resultSet.addAll(setA);
        resultSet.addAll(setB);
    }

    /** Creates a new set and fills it with the union of this set with some otherSet. */
    public SortedArraySet<E> union(SortedArraySet<E> otherSet) {
        var res = new SortedArraySet<E>();
        union(res, this, otherSet);
        return res;
    }
}
