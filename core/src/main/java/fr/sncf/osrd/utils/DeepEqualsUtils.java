package fr.sncf.osrd.utils;

import java.util.Collection;
import java.util.List;

public abstract class DeepEqualsUtils {
    /** Deeply compares two DeepComparable objects */
    public static <T extends DeepComparable<T>> boolean deepEquals(T a, T b) {
        if (a == null) {
            return b == null;
        } else if (b == null)
            return false;

        return a.deepEquals(b);
    }

    /** Deeply compares two arrays */
    public static <T extends DeepComparable<T>> boolean deepEquals(T[] arrayA, T[] arrayB) {
        if ((arrayA == null) != (arrayB == null))
            return false;

        if (arrayA == null)
            return true;

        if (arrayA.length != arrayB.length)
            return false;

        for (int i = 0; i < arrayA.length; i++) {
            if (!deepEquals(arrayA[i], arrayB[i]))
                return false;
        }
        return true;
    }

    /** Deep compare two lists */
    public static <T extends DeepComparable<T>> boolean deepEquals(List<T> arrayA, List<T> arrayB) {
        if ((arrayA == null) != (arrayB == null))
            return false;

        if (arrayA == null)
            return true;

        if (arrayA.size() != arrayB.size())
            return false;

        for (int i = 0; i < arrayA.size(); i++) {
            if (!deepEquals(arrayA.get(i), arrayB.get(i)))
                return false;
        }
        return true;
    }

    /** Deep compare two lists */
    public static <T extends DeepComparable<T>> boolean deepEquals(Collection<T> collA, Collection<T> collB) {
        if ((collA == null) != (collB == null))
            return false;

        if (collA == null)
            return true;

        if (collA.size() != collB.size())
            return false;

        var iterA = collA.iterator();
        var iterB = collB.iterator();
        for (int i = 0; i < collA.size(); i++)
            if (!deepEquals(iterA.next(), iterB.next()))
                return false;
        return true;
    }

    /** Deep compare two lists of arrays */
    public static <T extends DeepComparable<T>> boolean deepArrayEquals(List<T[]> arrayA, List<T[]> arrayB) {
        if ((arrayA == null) != (arrayB == null))
            return false;

        if (arrayA == null)
            return true;

        if (arrayA.size() != arrayB.size())
            return false;

        for (int i = 0; i < arrayA.size(); i++) {
            var a = arrayA.get(i);
            var b = arrayB.get(i);
            if (!deepEquals(a, b))
                return false;
        }
        return true;
    }
}
