package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTVDSection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTrainDetector extends DirectionalRJSTrackObject {
    public final String id;

    /** The tvd in the forward direction on the edge */
    @Json(name = "forward_TVD")
    ID<RJSTVDSection> forwardTVD;

    /** The tvd in the backward direction on the edge */
    @Json(name = "backward_TVD")
    ID<RJSTVDSection> backwardTVD;

    RJSTrainDetector(String id, Navigability navigability, double position) {
        super(navigability, position);
        this.id = id;
    }
}
