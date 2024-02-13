package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRouteWaypoint extends RJSTrackObject implements Identified {
    public RJSRouteWaypoint(String id, Double position, String track) {
        this.id = id;
        this.position = position;
        this.track = track;
    }

    public RJSRouteWaypoint() {
        this.id = null;
        this.position = -1;
        this.track = null;
    }

    public String id;

    @Override
    public String getID() {
        return id;
    }
}
