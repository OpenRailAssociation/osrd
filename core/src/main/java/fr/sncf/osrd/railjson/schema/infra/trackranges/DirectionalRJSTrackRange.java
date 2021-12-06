package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class DirectionalRJSTrackRange extends RJSTrackRange {
    @Json(name = "applicable_direction")
    public ApplicableDirection applicableDirection;

    DirectionalRJSTrackRange(ApplicableDirection applicableDirection, double begin, double end) {
        super(begin, end);
        this.applicableDirection = applicableDirection;
    }

    @Override
    public ApplicableDirection getNavigability() {
        return applicableDirection;
    }
}
