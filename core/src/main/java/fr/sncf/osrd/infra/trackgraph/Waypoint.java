package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.infra.TVDSectionPath;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.Node;
import java.util.ArrayList;

public abstract class Waypoint extends Node implements ActionPoint {
    public final String id;

    /** List of neighbors seen when moving across the detector from the beginning of the track section to the end */
    public final ArrayList<TVDSectionPath> startToStopNeighbors = new ArrayList<>();

    /** List of neighbors seen when moving across the detector from the end of the track section to the beginning */
    public final ArrayList<TVDSectionPath> stopToStartNeighbors = new ArrayList<>();

    /** List of neighbors seen when moving across the detector from the end of the track section to the beginning */
    public final ArrayList<Route> startToStopRoutes = new ArrayList<>();

    /**
     * List of routes that can be left when moving across the detector from the end
     * of the track section to the beginning
     */
    public final ArrayList<Route> incomingStartToStopRoutes = new ArrayList<>();

    /** List of neighbors seen when moving across the detector from the beginning of the track section to the end */
    public final ArrayList<Route> stopToStartRoutes = new ArrayList<>();

    /**
     * List of routes that can be left when moving across the detector from the
     * beginning of the track section to the end
     */
    public final ArrayList<Route> incomingStopToStartRoutes = new ArrayList<>();

    /** Tvd section that starts before the waypoint */
    public TVDSection beforeTvdSection = null;

    /** Tvd section that starts after the waypoint */
    public TVDSection afterTvdSection = null;

    public Waypoint(int index, String id) {
        super(index);
        this.id = id;
    }

    /** Returns adjacent tvd section path list, given a direction */
    public ArrayList<TVDSectionPath> getTvdSectionPathNeighbors(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return startToStopNeighbors;
        return stopToStartNeighbors;
    }

    /** Returns adjacent route list, given a direction */
    public ArrayList<Route> getRouteNeighbors(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return startToStopRoutes;
        return stopToStartRoutes;
    }

    /** Returns incomming route list, given a direction */
    public ArrayList<Route> getIncomingRouteNeighbors(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return incomingStartToStopRoutes;
        return incomingStopToStartRoutes;
    }

    public TVDSection getTVDSection(EdgeDirection dir) {
        return dir == EdgeDirection.START_TO_STOP ? afterTvdSection : beforeTvdSection;
    }
}
