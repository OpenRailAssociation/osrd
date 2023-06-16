package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import java.util.Objects;

public class RJSTrackRange extends RJSRange {
    @Json(name = "track")
    public String trackSectionID;

    public RJSTrackRange(String trackSectionID, double begin, double end) {
        super(begin, end);
        this.trackSectionID = trackSectionID;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSTrackRange that)) return false;
        if (!super.equals(o)) return false;
        return Objects.equals(trackSectionID, that.trackSectionID);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), trackSectionID);
    }
}
