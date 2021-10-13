package fr.sncf.osrd.interactive.action_point_adapters;

import fr.sncf.osrd.infra.trackgraph.Waypoint;

public final class SerializedWaypoint extends SerializedActionPoint {
    public SerializedWaypoint(Waypoint waypoint) {
        super(waypoint.id);
    }
}
