package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.RJSApplicableDirection;

public class DirectionalRJSTrackRange extends RJSTrackRange {
    @Json(name = "applicable_directions")
    public RJSApplicableDirection applicableDirections;

    DirectionalRJSTrackRange(RJSApplicableDirection applicableDirections, double begin, double end) {
        this.begin = begin;
        this.end = end;
        this.applicableDirections = applicableDirections;
    }

    @Override
    public RJSApplicableDirection getNavigability() {
        return applicableDirections;
    }
}
