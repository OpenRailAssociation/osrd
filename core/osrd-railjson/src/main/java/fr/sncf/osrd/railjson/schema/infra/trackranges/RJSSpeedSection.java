package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.List;
import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSpeedSection implements Identified {
    public String id;

    @Json(name = "speed_limit")
    private Double speedLimit = null;

    @Json(name = "speed_limit_by_tag")
    public Map<String, Double> speedLimitByTag;

    @Json(name = "track_ranges")
    public List<RJSApplicableDirectionsTrackRange> trackRanges;

    @Json(name = "on_routes")
    public List<String> onRoutes = null;

    /** Constructor */
    public RJSSpeedSection(
            String id,
            Double speedLimit,
            Map<String, Double> speedLimitByTag,
            List<RJSApplicableDirectionsTrackRange> trackRanges,
            List<String> onRoutes) {
        this.id = id;
        this.speedLimit = speedLimit;
        this.speedLimitByTag = speedLimitByTag;
        this.trackRanges = trackRanges;
        this.onRoutes = onRoutes;
    }

    /** Create an uninitialized speed section (used by the deserializer). */
    public RJSSpeedSection() {}

    /** Retrieve default speed limit */
    public double getSpeedLimit() {
        if (speedLimit == null) return Double.POSITIVE_INFINITY;
        return speedLimit;
    }

    @Override
    public String getID() {
        return id;
    }
}
