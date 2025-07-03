package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import java.util.List;
import java.util.Objects;

public class RJSRoutePath {
    public final String route;

    @Json(name = "track_sections")
    public final List<RJSDirectionalTrackRange> trackSections;

    /** Constructor */
    public RJSRoutePath(String route, List<RJSDirectionalTrackRange> trackSections) {
        this.route = route;
        this.trackSections = trackSections;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSRoutePath that)) return false;
        return Objects.equals(route, that.route) && Objects.equals(trackSections, that.trackSections);
    }

    @Override
    public int hashCode() {
        return Objects.hash(route, trackSections);
    }
}
