package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class RJSRoutePath {
    public final String route;
    @Json(name = "track_sections")
    public final List<RJSDirectionalTrackRange> trackSections;
    @Json(name = "signaling_type")
    public final String signalingType;

    /** Constructor */
    public RJSRoutePath(String route, List<RJSDirectionalTrackRange> trackSections, String signalingType) {
        this.route = route;
        this.trackSections = trackSections;
        this.signalingType = signalingType;
    }

    /** Constructor with empty ranges */
    public RJSRoutePath(String route, String signalingType) {
        this.route = route;
        this.trackSections = new ArrayList<>();
        this.signalingType = signalingType;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSRoutePath that)) return false;
        return Objects.equals(route, that.route)
                && Objects.equals(trackSections, that.trackSections)
                && Objects.equals(signalingType, that.signalingType);
    }

    @Override
    public int hashCode() {
        return Objects.hash(route, trackSections, signalingType);
    }
}
