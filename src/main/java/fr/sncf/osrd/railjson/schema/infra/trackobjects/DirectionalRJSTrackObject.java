package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import com.squareup.moshi.Json;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

public class DirectionalRJSTrackObject extends RJSTrackObject {
    @Json(name = "application_directions")
    public ApplicableDirections applicableDirections;

    DirectionalRJSTrackObject(ApplicableDirections applicableDirections, double position) {
        super(position);
        this.applicableDirections = applicableDirections;
    }

    @Override
    public ApplicableDirections getNavigability() {
        return applicableDirections;
    }
}
