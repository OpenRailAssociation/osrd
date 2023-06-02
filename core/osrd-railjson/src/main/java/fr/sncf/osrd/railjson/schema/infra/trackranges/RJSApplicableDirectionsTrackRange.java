package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;

public class RJSApplicableDirectionsTrackRange extends RJSTrackRange {
    @Json(name = "applicable_directions")
    public ApplicableDirection applicableDirections;

    /** Constructor */
    public RJSApplicableDirectionsTrackRange(
            String trackSectionID,
            ApplicableDirection applicableDirections,
            double begin,
            double end
    ) {
        super(trackSectionID, begin, end);
        this.applicableDirections = applicableDirections;
    }
}
