package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.IPointValue;

public class RJSRouteWaypoint extends RJSTrackObject implements Identified, IPointValue<RJSRouteWaypoint> {
    public String id;

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public ApplicableDirection direction;

    RJSRouteWaypoint(String id, ApplicableDirection applicableDirection,
                     double position, ObjectRef<RJSTrackSection> track) {
        super(track, position);
        this.id = id;
        this.track = track;
        this.position = position;
        this.direction = applicableDirection;
    }

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