package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.detectorgraph.TVDSectionPath;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.Waypoint;

import java.util.ArrayList;

public class TVDSection {
    public final String id;
    public final ArrayList<Waypoint> waypoints;
    public final ArrayList<TVDSectionPath> sections = new ArrayList<>();
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final boolean isBerthingTrack;

    /**
     * Instantiate a TVDSection.
     * Note: The list of TVDSectionPath will be automatically be filled building the infra.
     */
    public TVDSection(String id, ArrayList<Waypoint> waypoints, boolean isBerthingTrack) {
        this.id = id;
        this.waypoints = waypoints;
        this.isBerthingTrack = isBerthingTrack;
    }
}
