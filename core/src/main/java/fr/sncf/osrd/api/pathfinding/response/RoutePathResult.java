package fr.sncf.osrd.api.pathfinding.response;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import java.util.ArrayList;
import java.util.List;

/**
 * A single route on the path
 */
public class RoutePathResult {
    public final RJSObjectRef<RJSRoute> route;
    @Json(name = "track_sections")
    public final List<DirTrackRange> trackSections = new ArrayList<>();
    @Json(name = "signaling_type")
    public final String signalingType;

    public RoutePathResult(RJSObjectRef<RJSRoute> route, String signalingType) {
        this.route = route;
        this.signalingType = signalingType;
    }
}
