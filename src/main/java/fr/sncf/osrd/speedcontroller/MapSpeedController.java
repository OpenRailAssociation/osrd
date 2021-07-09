package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.utils.SortedDoubleMap;

public class MapSpeedController extends SpeedController {

    /** Keys are positions in space, values are speed */
    private final transient SortedDoubleMap values;

    public MapSpeedController(SortedDoubleMap values, double begin, double end) {
        super(begin, end);
        this.values = values;
    }

    public MapSpeedController(SortedDoubleMap values) {
        super(values.firstKey(), values.lastKey());
        this.values = values;
    }

    @Override
    public SpeedDirective getDirective(double pathPosition) {
        return new SpeedDirective(values.interpolate(pathPosition));
    }

    @Override
    public SpeedController scaled(double scalingFactor) {
        var newValues = new SortedDoubleMap(values);
        newValues.replaceAll((k, v) -> v * scalingFactor);
        return new MapSpeedController(newValues, beginPosition, endPosition);
    }

    @Override
    public boolean deepEquals(SpeedController other) {
        if (!(other instanceof MapSpeedController))
            return false;
        return ((MapSpeedController) other).values.equals(values);
    }
}
