package fr.sncf.osrd.infra.api.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import java.util.Collection;
import java.util.Set;

public class SpeedLimits {

    private final double defaultSpeedLimit;
    private final ImmutableMap<String, Double> speedLimitByTag;

    /** Constructor */
    public SpeedLimits(double defaultSpeedLimit, ImmutableMap<String, Double> speedLimitByTag) {
        this.defaultSpeedLimit = defaultSpeedLimit;
        this.speedLimitByTag = speedLimitByTag;
    }

    /** Directly creates a SpeedLimits instance from the railjson dict */
    public static SpeedLimits from(RJSSpeedSection rjsSpeedSection) {
        return new SpeedLimits(
                rjsSpeedSection.speedLimit,
                ImmutableMap.copyOf(rjsSpeedSection.speedLimitByTag)
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
        if (Double.isFinite(min) || Double.isNaN(defaultSpeedLimit))
            return min;
        else
            return defaultSpeedLimit;
    }
}
