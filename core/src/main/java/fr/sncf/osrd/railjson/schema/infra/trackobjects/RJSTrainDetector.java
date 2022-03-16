package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

public class RJSTrainDetector extends RJSRouteWaypoint {
    /** Constructor */
    public RJSTrainDetector(String id, double position, RJSObjectRef<RJSTrackSection> track) {
        super(id);
        this.position = position;
        this.track = track;
    }
}
