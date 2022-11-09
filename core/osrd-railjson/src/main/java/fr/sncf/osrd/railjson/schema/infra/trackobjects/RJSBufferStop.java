package fr.sncf.osrd.railjson.schema.infra.trackobjects;

public class RJSBufferStop extends RJSRouteWaypoint {
    /** Constructor */
    public RJSBufferStop(String id, double position, String track) {
        super(id);
        this.position = position;
        this.track = track;
    }
}
