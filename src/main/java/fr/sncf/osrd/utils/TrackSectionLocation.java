package fr.sncf.osrd.utils;

import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.TrackSection;

public class TrackSectionLocation {
    public final TrackSection edge;
    public final double position;

    public TrackSectionLocation(TrackSection edge, double position) {
        this.edge = edge;
        this.position = position;
    }
}
