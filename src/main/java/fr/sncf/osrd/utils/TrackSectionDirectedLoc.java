package fr.sncf.osrd.utils;

import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class TrackSectionDirectedLoc extends TrackSectionLoc {
    public final EdgeDirection direction;

    public TrackSectionDirectedLoc(
            TrackSection edge,
            double offset,
            EdgeDirection direction
    ) {
        super(edge, offset);
        this.direction = direction;
    }
}
