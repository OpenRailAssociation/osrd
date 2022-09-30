package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;

public class RJSApplicableDirectionsTrackRange extends RJSTrackRange {
    public String track;
    @Json(name = "applicable_directions")
    public ApplicableDirection applicableDirections;

    /** Constructor */
    public RJSApplicableDirectionsTrackRange(
            String track,
            ApplicableDirection applicableDirections,
            double begin,
            double end
    ) {
        this.track = track;
        this.begin = begin;
        this.end = end;
        this.applicableDirections = applicableDirections;
    }

    @Override
    public ApplicableDirection getNavigability() {
        return applicableDirections;
    }
}
