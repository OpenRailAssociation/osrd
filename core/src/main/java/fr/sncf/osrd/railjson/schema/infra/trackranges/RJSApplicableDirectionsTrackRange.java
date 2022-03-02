package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSApplicableDirectionsTrackRange extends RJSTrackRange {
    public RJSObjectRef<RJSTrackSection> track;
    @Json(name = "applicable_directions")
    public ApplicableDirection applicableDirections;

    RJSApplicableDirectionsTrackRange(
            RJSObjectRef<RJSTrackSection> track,
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
