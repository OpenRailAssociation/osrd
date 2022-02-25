package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.railjson.schema.infra.trackranges.SingleDirectionalRJSTrackRange;
import java.util.List;

public class RJSRoute implements Identified {
    public String id;

    /** List of the track ranges on the route */
    public List<SingleDirectionalRJSTrackRange> path;

    @Json(name = "release_detectors")
    public List<RJSObjectRef<RJSTrainDetector>> releaseDetectors;

    /** Waypoint placed just before the route, either a buffer stop or a detector attached to a signal */
    @Json(name = "entry_point")
    public RJSObjectRef<RJSRouteWaypoint> entryPoint;

    /** The last waypoint of the route, either a buffer stop or a detector */
    @Json(name = "exit_point")
    public RJSObjectRef<RJSRouteWaypoint> exitPoint;

    /** Routes are described as a list of TVD Sections, Switches in specific positions, and an entry point */
    public RJSRoute(
            String id,
            List<SingleDirectionalRJSTrackRange> path,
            List<RJSObjectRef<RJSTrainDetector>> releaseDetectors,
            RJSObjectRef<RJSRouteWaypoint> entryPoint,
            RJSObjectRef<RJSRouteWaypoint> exitPoint
    ) {
        this.id = id;
        this.path = path;
        this.releaseDetectors = releaseDetectors;
        this.entryPoint = entryPoint;
        this.exitPoint = exitPoint;
    }

    @Override
    public String getID() {
        return id;
    }

    public enum State {
        FREE,
        REQUESTED,
        RESERVED,
        OCCUPIED,
        CONFLICT
    }
}
