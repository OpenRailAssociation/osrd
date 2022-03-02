package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSpeedSection implements Identified {
    public String id;
    public double speed;

    @Json(name = "track_ranges")
    public List<RJSApplicableDirectionsTrackRange> trackRanges;

    RJSSpeedSection(
            String id,
            double speed,
            List<RJSApplicableDirectionsTrackRange> trackRanges
    ) {
        this.id = id;
        this.speed = speed;
        this.trackRanges = trackRanges;
    }

    @Override
    public String getID() {
        return id;
    }
}
