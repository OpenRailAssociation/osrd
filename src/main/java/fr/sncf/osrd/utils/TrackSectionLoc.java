package fr.sncf.osrd.utils;

import fr.sncf.osrd.infra.trackgraph.TrackSection;

public class TrackSectionLoc {
    public final TrackSection edge;
    public final double offset;

    public TrackSectionLoc(TrackSection edge, double offset) {
        this.edge = edge;
        this.offset = offset;
    }
}
