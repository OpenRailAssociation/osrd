package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.infra.signaling.TrackSensor;

public abstract class Waypoint implements TrackSensor {
    public final String id;

    public Waypoint(String id) {
        this.id = id;
    }
}
