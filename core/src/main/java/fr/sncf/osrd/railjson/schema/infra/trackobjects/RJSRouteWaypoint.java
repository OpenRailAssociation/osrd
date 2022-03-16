package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.utils.graph.IPointValue;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRouteWaypoint extends RJSTrackObject implements Identified, IPointValue<RJSRouteWaypoint> {
    public RJSRouteWaypoint(String id) {
        this.id = id;
    }

    public RJSRouteWaypoint() {
        this.id = null;
    }

    public String id;

    @Override
    public String getID() {
        return id;
    }

    @Override
    public double getPosition() {
        return position;
    }

    @Override
    public RJSRouteWaypoint getValue() {
        return this;
    }
}