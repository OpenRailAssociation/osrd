package fr.sncf.osrd.utils;

import java.util.TreeMap;

public class SortedDoubleMap extends TreeMap<Double, Double> {

    private static final long serialVersionUID = -4311554160237448509L;

    public SortedDoubleMap() {
        super();
    }

    public SortedDoubleMap(TreeMap<Double, Double> other) {
        super(other);
    }
    public double interpolate(double x) {
        // last pair of (position, speed) before the given position
        var entryBefore = floorEntry(x);

        // first pair of (position, speed) after the given position
        var entryAfter = ceilingEntry(x);

        if (entryAfter == null)
            entryAfter = lastEntry();
        if (entryBefore == null)
            entryBefore = firstEntry();

        var valueBefore = entryBefore.getValue();
        var positionBefore = entryBefore.getKey();
        var valueAfter = entryAfter.getValue();
        var positionAfter = entryAfter.getKey();

        // If the position is the same as the entry before, avoids dividing by 0
        if (Math.abs(positionAfter - positionBefore) < 1e-5)
            return valueBefore;
        else {
            // slope of the curve between points before and after
            var slope = (valueAfter - valueBefore) / (positionAfter - positionBefore);
            return valueBefore + (x - positionBefore) * slope;
        }
    }
}
