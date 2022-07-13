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
    public double speedLimit;
    @Json(name = "speed_limit_by_tag")
    public Map<String, Double> speedLimitByTag;

    @Json(name = "track_ranges")
    public List<RJSApplicableDirectionsTrackRange> trackRanges;

    /** Constructor */
    public RJSSpeedSection(
            String id,
            double speedLimit,
            Map<String, Double> speedLimitByTag,
            List<RJSApplicableDirectionsTrackRange> trackRanges
    ) {
        this.id = id;
        this.speedLimit = speedLimit;
        this.speedLimitByTag = speedLimitByTag;
        this.trackRanges = trackRanges;
    }

    @Override
    public String getID() {
        return id;
    }
}
