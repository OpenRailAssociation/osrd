package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.utils.Interpolation;

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
        return new SpeedDirective(Interpolation.interpolate(values, pathPosition));
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
