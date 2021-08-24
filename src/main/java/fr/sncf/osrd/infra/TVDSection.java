package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.trackgraph.Waypoint;

import java.util.ArrayList;

public final class TVDSection implements Comparable<TVDSection> {
    public String id = null;
    public int index = -1;
    public final ArrayList<Waypoint> waypoints = new ArrayList<>();
    public final ArrayList<Route> routeSubscribers = new ArrayList<>();

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public boolean isBerthingTrack = false;

    @Override
    public int compareTo(TVDSection o) {
        return id.compareTo(o.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != TVDSection.class)
            return false;
        return id.equals(((TVDSection) obj).id);
    }

    @Override
    public String toString() {
        return String.format("TVD section {id=%s, index=%d, waypoints=%s}", id, index, waypoints);
    }
}
