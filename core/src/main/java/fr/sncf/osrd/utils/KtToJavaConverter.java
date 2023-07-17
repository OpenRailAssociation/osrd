package fr.sncf.osrd.utils;

import fr.sncf.osrd.utils.indexing.DirStaticIdxList;
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArraySet;
import fr.sncf.osrd.utils.indexing.StaticIdxList;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Converts Kt objects to correct corresponding Java objects
 */
public class KtToJavaConverter {

    /**
     * Iterating over an iterable of value class doesn't automatically convert it to the underlying type,
     * this prevents typing errors caused by java inability to handle them
     */
    public static <T> List<Integer> toIntList(StaticIdxList<T> list) {
        var res = new ArrayList<Integer>();
        for (int i = 0; i < list.getSize(); i++)
            res.add(list.get(i));
        return res;
    }

    /**
     * Iterating over an iterable of value class doesn't automatically convert it to the underlying type,
     * this prevents typing errors caused by java inability to handle them
     * TODO: find a better way to handle this
     */
    public static <T> List<Integer> toIntList(DirStaticIdxList<T> list) {
        var res = new ArrayList<Integer>();
        for (int i = 0; i < list.getSize(); i++)
            res.add(list.get(i));
        return res;
    }

    /**
     * Iterating over an iterable of value class doesn't automatically convert it to the underlying type,
     * this prevents typing errors caused by java inability to handle them
     */
    public static <T> Set<Integer> toIntSet(MutableStaticIdxArraySet<T> set) {
        var res = new HashSet<Integer>();
        for (int i = 0; i < set.getSize(); i++)
            res.add(set.getAtIndex(i));
        return res;
    }
}
