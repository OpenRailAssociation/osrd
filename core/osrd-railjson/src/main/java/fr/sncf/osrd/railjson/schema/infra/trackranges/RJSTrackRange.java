package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;

public class RJSTrackRange extends RJSRange {
    @Json(name = "track")
    public String trackSectionID;

    public RJSTrackRange(String trackSectionID, double begin, double end) {
        super(begin, end);
        this.trackSectionID = trackSectionID;
    }
}
