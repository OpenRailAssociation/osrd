package fr.sncf.osrd.infra.api.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Sets;
import com.squareup.moshi.JsonDataException;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.util.Objects;

public final class SpeedLimits {

    public final double defaultSpeedLimit;
    public final ImmutableMap<String, Double> speedLimitByTag;

    /** Constructor */
    public SpeedLimits(double defaultSpeedLimit, ImmutableMap<String, Double> speedLimitByTag) {
        assert !Double.isNaN(defaultSpeedLimit);
        this.defaultSpeedLimit = defaultSpeedLimit;
        this.speedLimitByTag = speedLimitByTag;
    }

    /** Directly creates a SpeedLimits instance from the railjson dict */
    public static SpeedLimits from(RJSSpeedSection rjsSpeedSection) {
        double speedLimit = rjsSpeedSection.getSpeedLimit();
        ImmutableMap<String, Double> speedLimitByTag = ImmutableMap.copyOf(rjsSpeedSection.speedLimitByTag);

        validateSpeedLimit(speedLimit);

        for (Double limit : speedLimitByTag.values()) {
            validateSpeedLimit(limit);
        }

        return new SpeedLimits(speedLimit, speedLimitByTag);
    }

    /** validates that speed limit is greater than 0 */
    private static void validateSpeedLimit(Double speedLimit) throws JsonDataException {
        if (speedLimit != null && speedLimit <= 0) {
            throw OSRDError.newInvalidSpeedLimitError(speedLimit);
        }
    }

    /** Returns the speed limit for the given tags */
    public double getSpeedLimit(String tag) {
        var min = Double.POSITIVE_INFINITY;

        var value = speedLimitByTag.getOrDefault(tag, Double.POSITIVE_INFINITY);
        if (value != null)
            min = Double.min(min, value);

        if (Double.isFinite(min))
            return min;
        return defaultSpeedLimit;
    }


    /** Merges two overlapping speed limits, picking the most restrictive speed for each category */
    public static SpeedLimits merge(SpeedLimits a, SpeedLimits b) {
        if (a == null)
            return b;
        if (b == null)
            return a;
        var defaultSpeed = Double.min(a.defaultSpeedLimit, b.defaultSpeedLimit);
        var categories = Sets.union(a.speedLimitByTag.keySet(), b.speedLimitByTag.keySet());
        var builder = ImmutableMap.<String, Double>builder();
        for (var category : categories) {
            Double speedA = a.speedLimitByTag.getOrDefault(category, a.defaultSpeedLimit);
            Double speedB = b.speedLimitByTag.getOrDefault(category, b.defaultSpeedLimit);
            assert speedA != null && speedB != null;
            var speed = Double.min(speedA, speedB);
            builder.put(category, speed);
        }
        return new SpeedLimits(defaultSpeed, builder.build());
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SpeedLimits other = (SpeedLimits) o;
        return Double.compare(defaultSpeedLimit, other.defaultSpeedLimit) == 0
                && Objects.equals(speedLimitByTag, other.speedLimitByTag);
    }

    @Override
    public int hashCode() {
        return Objects.hash(defaultSpeedLimit, speedLimitByTag);
    }
}
