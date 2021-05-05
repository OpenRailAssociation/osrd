package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSTrainDetector extends RJSRouteWaypoint {
    public RJSTrainDetector(String id, ApplicableDirection applicableDirection, double position) {
        super(id, applicableDirection, position);
    }
}
