package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import com.squareup.moshi.Json;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class DirectionalRJSTrackObject extends RJSTrackObject {
    @Json(name = "applicable_direction")
    public ApplicableDirection applicableDirection;

    DirectionalRJSTrackObject(ApplicableDirection applicableDirection, double position) {
        super(position);
        this.applicableDirection = applicableDirection;
    }

    @Override
    public ApplicableDirection getApplicableDirection() {
        return applicableDirection;
    }
}
