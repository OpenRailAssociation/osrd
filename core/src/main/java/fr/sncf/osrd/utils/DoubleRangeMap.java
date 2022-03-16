package fr.sncf.osrd.utils;

import java.util.*;

public class DoubleRangeMap extends TreeMap<Double, Double> {
    private static final long serialVersionUID = -4311554160237448509L;

    /** Add a value in a given range */
    public void addRange(double begin, double end, double value) {
        assert begin != end : "Can't add an empty range";
        put(begin, value);
        if (!containsKey(end))
            put(end, 0.);
    }

    /** Retrieve values in a given range returning inner ranges and their values */
    public HashMap<Range, Double> getValuesInRange(double begin, double end) {
        // Handle reversed range
        if (end < begin)
            return getValuesInRange(end, begin);
        var res = new HashMap<Range, Double>();
        var floorEntry = floorEntry(begin);
        double lastValue = 0.;

        if (floorEntry != null)
            lastValue = floorEntry.getValue();

        for (var entry : subMap(begin, end).entrySet()) {
            if (entry.getKey() <= begin)
                continue;
            res.put(new Range(begin, entry.getKey()), lastValue);
            begin = entry.getKey();
            lastValue = entry.getValue();
        }

        res.put(new Range(begin, end), lastValue);
        return res;
    }

    /** Merges identical adjacent ranges */
    public DoubleRangeMap simplify() {
        var entries = new ArrayList<>(entrySet());
        if (entries.size() == 0)
            return this;
        entries.sort(Comparator.comparingDouble(Map.Entry::getKey));
        var lastValue = entries.get(0).getValue();
        for (int i = 1; i < entries.size(); i++) {
            var value = entries.get(i).getValue();
            if (value.equals(lastValue))
                remove(entries.get(i).getKey());
            lastValue = value;
        }
        return this;
    }
}
