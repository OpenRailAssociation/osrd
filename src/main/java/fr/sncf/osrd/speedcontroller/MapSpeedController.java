package fr.sncf.osrd.speedcontroller;

import java.util.NavigableMap;
import java.util.TreeMap;

public class MapSpeedController extends SpeedController {

    /** Keys are positions in space, values are speed */
    private final transient NavigableMap<Double, Double> values;

    public MapSpeedController(NavigableMap<Double, Double> values) {
        super(values.firstKey(), values.lastKey());
        this.values = values;
    }

    @Override
    public SpeedDirective getDirective(double pathPosition) {

        // last pair of (position, speed) before the given position
        var entryBefore = values.floorEntry(pathPosition);

        // first pair of (position, speed) after the given position
        var entryAfter = values.ceilingEntry(pathPosition);

        var speedBefore = entryBefore.getValue();
        var positionBefore = entryBefore.getKey();
        var speedAfter = entryAfter.getValue();
        var positionAfter = entryAfter.getKey();

        // If the position is the same as the entry before, avoids dividing by 0
        if (Math.abs(positionAfter - positionBefore) < 1e-5)
            return new SpeedDirective(speedBefore);
        else {
            // slope of the curve between points before and after
            var slope = (speedAfter - speedBefore) / (positionAfter - positionBefore);
            return new SpeedDirective(speedBefore + (pathPosition - positionBefore) * slope);
        }
    }

    @Override
    public SpeedController scaled(double scalingFactor) {
        var newValues = new TreeMap<>(values);
        newValues.replaceAll((k, v) -> v * scalingFactor);
        return new MapSpeedController(newValues);
    }

    @Override
    public boolean deepEquals(SpeedController other) {
        if (!(other instanceof MapSpeedController))
            return false;
        return ((MapSpeedController) other).values.equals(values);
    }
}
