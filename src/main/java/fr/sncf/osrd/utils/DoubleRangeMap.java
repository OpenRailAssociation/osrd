package fr.sncf.osrd.utils;


import javafx.util.Pair;

import java.util.HashMap;
import java.util.TreeMap;

public class DoubleRangeMap extends TreeMap<Double, Double> {
    private static final long serialVersionUID = -4311554160237448509L;

    /** Add a value in a given range */
    public void addRange(double begin, double end, double value) {
        put(begin, value);
        if (!containsKey(end))
            put(end, 0.);
    }

    /** Retrieve values in a given range returning inner ranges and their values */
    public HashMap<Pair<Double, Double>, Double> getValuesInRange(double begin, double end) {
        // Handle reversed range
        if (end < begin)
            return getValuesInRange(end, begin);

        var res = new HashMap<Pair<Double, Double>, Double>();
        var floorEntry = floorEntry(begin);
        double lastValue = 0.;

        if (floorEntry != null)
            lastValue = floorEntry.getValue();

        for (var entry : subMap(begin, end).entrySet()) {
            if (entry.getKey() >= begin)
                continue;
            res.put(new Pair<>(begin, entry.getKey()), lastValue);
            begin = entry.getKey();
            lastValue = entry.getValue();
        }

        res.put(new Pair<>(begin, end), lastValue);
        return res;
    }
}
