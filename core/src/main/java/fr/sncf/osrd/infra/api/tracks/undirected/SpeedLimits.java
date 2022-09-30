package fr.sncf.osrd.infra.api.tracks.undirected;

import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import java.util.Collection;
import java.util.Map;

public class SpeedLimits {

    private double defaultSpeedLimit;
    private final Map<String, Double> speedLimitByTag;

    /** Constructor */
    public SpeedLimits(double defaultSpeedLimit, Map<String, Double> speedLimitByTag) {
        assert !Double.isNaN(defaultSpeedLimit);
        this.defaultSpeedLimit = defaultSpeedLimit;
        this.speedLimitByTag = speedLimitByTag;
    }

    /** Directly creates a SpeedLimits instance from the railjson dict */
    public static SpeedLimits from(RJSSpeedSection rjsSpeedSection) {
        return new SpeedLimits(
                rjsSpeedSection.getSpeedLimit(),
                Map.copyOf(rjsSpeedSection.speedLimitByTag)
        );
    }

    /** Returns the speed limit for the given tags */
    public double getSpeedLimit(Collection<String> tags) {
        var min = Double.POSITIVE_INFINITY;
        for (var tag : tags) {
            var value = speedLimitByTag.getOrDefault(tag, Double.POSITIVE_INFINITY);
            if (value != null)
                min = Double.min(min, value);
        }
        if (Double.isFinite(min))
            return min;
        return defaultSpeedLimit;
    }


    /** Merges two overlapping speed limits, picking the most restrictive speed for each category */
    public SpeedLimits merge(SpeedLimits other) {
        if (other == null)
            return this;
        defaultSpeedLimit = Double.min(defaultSpeedLimit, other.defaultSpeedLimit);
        for (var category : other.speedLimitByTag.keySet()) {
            Double speedA = speedLimitByTag.getOrDefault(category, Double.POSITIVE_INFINITY);
            Double speedB = other.speedLimitByTag.getOrDefault(category, Double.POSITIVE_INFINITY);
            var speed = Double.min(speedA, speedB);
            speedLimitByTag.put(category, speed);
        }
        return this;
    }
}
