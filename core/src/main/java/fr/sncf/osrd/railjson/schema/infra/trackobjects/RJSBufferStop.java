package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSBufferStop extends RJSRouteWaypoint {
    public RJSBufferStop(String id, double position,
                         RJSObjectRef<RJSTrackSection> track) {
        super(id, position, track);
    }
}
