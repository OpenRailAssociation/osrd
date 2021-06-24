package fr.sncf.osrd.utils;

import java.util.ArrayList;
import java.util.TreeMap;

public class DoubleRangeMap extends TreeMap<Double, Double> {
    private static final long serialVersionUID = -4311554160237448509L;

    public void addRange(double begin, double end, double value) {
        put(begin, value);
        if (!containsKey(end))
            put(end, 0.);
    }

    public ArrayList<Double> getValuesInRange(double begin, double end) {
        if (end < begin)
            return getValuesInRange(end, begin);

        var res = new ArrayList<Double>();
        if (this.firstKey() > end)
            return res;

        for (var key : keySet()) {
            if (key < begin)
                continue;
            res.add(this.get(key));
            if (key > end)
                return res;
        }

        return res;
    }
}
