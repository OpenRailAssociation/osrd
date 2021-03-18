package fr.sncf.osrd.railjson.infra.trackobjects;

import com.squareup.moshi.Json;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

public class DirectionalRJSTrackObject extends RJSTrackObject {
    @Json(name = "application_directions")
    public final ApplicableDirections applicableDirections;

    DirectionalRJSTrackObject(ApplicableDirections applicableDirections, double position) {
        super(position);
        this.applicableDirections = applicableDirections;
    }

    @Override
    public ApplicableDirections getNavigability() {
        return applicableDirections;
    }
}
