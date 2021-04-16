package fr.sncf.osrd.railjson.schema.common;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

public final class RJSTrackLocation {
    @Json(name = "track_section")
    public ID<RJSTrackSection> trackSection;
    public double offset;

    /** A location on a track section */
    public RJSTrackLocation(ID<RJSTrackSection> trackSection, double offset) {
        this.trackSection = trackSection;
        this.offset = offset;
    }
}
