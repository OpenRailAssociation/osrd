package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.IPointValue;

public class RJSRouteWaypoint extends RJSTrackObject implements Identified, IPointValue<RJSRouteWaypoint> {
    public String id;

    RJSRouteWaypoint(String id, double position, RJSObjectRef<RJSTrackSection> track) {
        super(track, position);
        this.id = id;
        this.track = track;
        this.position = position;
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