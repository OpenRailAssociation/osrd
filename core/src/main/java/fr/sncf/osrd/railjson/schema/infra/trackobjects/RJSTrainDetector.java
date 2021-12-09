package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSTrainDetector extends RJSRouteWaypoint {
    public RJSTrainDetector(String id, ApplicableDirection applicableDirection,
                            double position, RJSObjectRef<RJSTrackSection> track) {
        super(id, applicableDirection, position, track);
    }
}
