package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import java.util.ArrayList;
import java.util.Objects;

public final class TVDSection implements Comparable<TVDSection> {
    public int index = -1;
    public final ArrayList<Waypoint> waypoints = new ArrayList<>();
    public final ArrayList<Route> routeSubscribers = new ArrayList<>();

    @Override
    public int compareTo(TVDSection o) {
        return index - o.index;
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(index);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != TVDSection.class)
            return false;
        return index == ((TVDSection) obj).index;
    }

    @Override
    public String toString() {
        return String.format("TVD section {index=%d, waypoints=%s}", index, waypoints);
    }
}
