package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.utils.graph.ApplicableDirections;

public class RJSTrainDetector extends RJSRouteWaypoint {
    public RJSTrainDetector(String id, ApplicableDirections applicableDirections, double position) {
        super(id, applicableDirections, position);
    }
}
