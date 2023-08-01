package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import java.util.Objects;

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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSApplicableDirectionsTrackRange that)) return false;
        if (!super.equals(o)) return false;
        return Objects.equals(applicableDirections, that.applicableDirections);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), applicableDirections);
    }
}
