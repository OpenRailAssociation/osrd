package fr.sncf.osrd.infra.api.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Sets;
import com.squareup.moshi.JsonDataException;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public final class SpeedLimits {

    public final double defaultSpeedLimit;
    public final ImmutableMap<String, Double> speedLimitByTag;
    public final Map<String, Double> speedLimitOnRoute;

    /** Constructor */
    public SpeedLimits(
            double defaultSpeedLimit,
            ImmutableMap<String, Double> speedLimitByTag,
            Map<String, Double> speedLimitOnRoute) {
        assert !Double.isNaN(defaultSpeedLimit);
        this.defaultSpeedLimit = defaultSpeedLimit;
        this.speedLimitByTag = speedLimitByTag;
        this.speedLimitOnRoute = speedLimitOnRoute;
    }

    public SpeedLimits(double defaultSpeedLimit, ImmutableMap<String, Double> speedLimitByTag) {
        this(defaultSpeedLimit, speedLimitByTag, ImmutableMap.of());
    }

    /** Directly creates a SpeedLimits instance from the railjson dict */
    public static SpeedLimits from(RJSSpeedSection rjsSpeedSection) {
        double speedLimit = rjsSpeedSection.getSpeedLimit();
        ImmutableMap<String, Double> speedLimitByTag = ImmutableMap.copyOf(rjsSpeedSection.speedLimitByTag);

        var speedLimitOnRoute = new HashMap<String, Double>();
        if (rjsSpeedSection.onRoutes != null) {
            speedLimit = Double.POSITIVE_INFINITY;
            rjsSpeedSection.onRoutes.forEach(route -> speedLimitOnRoute.put(route, rjsSpeedSection.getSpeedLimit()));
        }

        if (!speedLimitByTag.isEmpty() && !speedLimitOnRoute.isEmpty()) {
            throw OSRDError.newInconsistentSpeedSectionError(rjsSpeedSection.id);
        }

        validateSpeedLimit(speedLimit);
        for (Double limit : speedLimitByTag.values()) {
            validateSpeedLimit(limit);
        }
        for (Double limit : speedLimitOnRoute.values()) {
            validateSpeedLimit(limit);
        }

        return new SpeedLimits(speedLimit, speedLimitByTag, speedLimitOnRoute);
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
        if (value != null) min = Double.min(min, value);

        if (Double.isFinite(min)) return min;
        return defaultSpeedLimit;
    }

    /** Merges two overlapping speed limits, picking the most restrictive speed for each category */
    public static SpeedLimits merge(SpeedLimits a, SpeedLimits b) {
        if (a == null) return b;
        if (b == null) return a;
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
        var speedLimitOnRoute = new HashMap<>(a.speedLimitOnRoute);
        b.speedLimitOnRoute.forEach((route, speed) -> {
            var mergedSpeed = Math.min(speed, speedLimitOnRoute.getOrDefault(route, Double.POSITIVE_INFINITY));
            speedLimitOnRoute.put(route, mergedSpeed);
        });
        return new SpeedLimits(defaultSpeed, builder.build(), speedLimitOnRoute);
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
