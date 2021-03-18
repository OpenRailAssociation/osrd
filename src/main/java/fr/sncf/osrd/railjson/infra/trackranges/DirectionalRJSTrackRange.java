package fr.sncf.osrd.railjson.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

public class DirectionalRJSTrackRange extends RJSTrackRange {
    @Json(name = "applicable_direction")
    public final ApplicableDirections applicableDirections;

    DirectionalRJSTrackRange(ApplicableDirections applicableDirections, double begin, double end) {
        super(begin, end);
        this.applicableDirections = applicableDirections;
    }

    @Override
    public ApplicableDirections getNavigability() {
        return applicableDirections;
    }
}
