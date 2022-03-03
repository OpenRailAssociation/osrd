package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.ArrayList;
import java.util.Arrays;

public class TVDSectionPath {
    public final TVDSection tvdSection;
    public final TrackSectionRange[] trackSections;

    public final Waypoint startWaypoint;
    public final Waypoint endWaypoint;
    public final double length;

    /** Create tvd section path */
    public TVDSectionPath(
            TVDSection tvdSection,
            ArrayList<TrackSectionRange> trackSections,
            Waypoint startWaypoint,
            Waypoint endWaypoint
    ) {
        this.tvdSection = tvdSection;
        this.trackSections = trackSections.toArray(new TrackSectionRange[trackSections.size()]);
        this.startWaypoint = startWaypoint;
        this.endWaypoint = endWaypoint;
        double length = 0;
        for (var segment : trackSections)
            length += segment.length();
        this.length = length;
    }

    public EdgeDirection getEndTrackDirection() {
        return trackSections[trackSections.length - 1].direction;
    }

    public EdgeDirection getStartTrackDirection() {
        return trackSections[0].direction;
    }

    public boolean contains(TrackSectionLocation location) {
        return Arrays.stream(trackSections).anyMatch(range -> range.containsLocation(location));
    }

    @Override
    public String toString() {
        return String.format("TVD section path {tvd=%s, tracks=%s}", tvdSection, Arrays.toString(trackSections));
    }
}
