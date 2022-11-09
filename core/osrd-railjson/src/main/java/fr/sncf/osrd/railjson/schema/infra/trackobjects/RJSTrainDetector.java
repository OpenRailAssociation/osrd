package fr.sncf.osrd.railjson.schema.infra.trackobjects;


public class RJSTrainDetector extends RJSRouteWaypoint {
    /** Constructor */
    public RJSTrainDetector(String id, double position, String track) {
        super(id);
        this.position = position;
        this.track = track;
    }
}
