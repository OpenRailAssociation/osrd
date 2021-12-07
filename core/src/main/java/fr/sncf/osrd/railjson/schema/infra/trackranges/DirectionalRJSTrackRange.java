package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class DirectionalRJSTrackRange extends RJSTrackRange {
    @Json(name = "applicable_directions")
    public ApplicableDirection applicableDirections;

    DirectionalRJSTrackRange(ApplicableDirection applicableDirections, double begin, double end) {
        super(begin, end);
        this.applicableDirections = applicableDirections;
    }

    @Override
    public ApplicableDirection getNavigability() {
        return applicableDirections;
    }
}
