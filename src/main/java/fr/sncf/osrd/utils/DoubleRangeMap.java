package fr.sncf.osrd.utils;

import java.util.ArrayList;
import java.util.TreeMap;

public class DoubleRangeMap extends TreeMap<Double, Double> {
    private static final long serialVersionUID = -4311554160237448509L;

    /** Add a value in a given range */
    public void addRange(double begin, double end, double value) {
        put(begin, value);
        if (!containsKey(end))
            put(end, 0.);
    }

    /** Retrieve a value */
    public ArrayList<Double> getValuesInRange(double begin, double end) {
        // Handle reversed range
        if (end < begin)
            return getValuesInRange(end, begin);

        var res = new ArrayList<Double>();
        var floorEntry = floorEntry(begin);
        if (floorEntry != null)
            res.add(floorEntry.getValue());

        for (var entry : subMap(begin, end).entrySet())
            res.add(entry.getValue());
        return res;
    }
}
