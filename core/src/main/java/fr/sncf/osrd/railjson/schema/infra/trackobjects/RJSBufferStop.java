package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSBufferStop extends RJSRouteWaypoint {
    public RJSBufferStop(String id, ApplicableDirection applicableDirection, double position,
                         ObjectRef<RJSTrackSection> track) {
        super(id, applicableDirection, position, track);
    }
}
