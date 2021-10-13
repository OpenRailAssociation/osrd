package fr.sncf.osrd.railml.routegraph;

import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.Node;
import java.util.ArrayList;

public class RMLRouteWaypoint extends Node {
    /** List of neighbors seen when moving across the detector from the end of the track section to the beginning */
    public final ArrayList<RMLTVDSectionPath> startToStopNeighbors = new ArrayList<>();

    /** List of neighbors seen when moving across the detector from the beginning of the track section to the end */
    public final ArrayList<RMLTVDSectionPath> stopToStartNeighbors = new ArrayList<>();

    public final String id;

    /** Instantiate a RMLRouteWaypoint
     * @param graph to register the waypoint
     * @param id of the waypoint. Must be unique.
     * @param index of the waypoint. Must be unique.
     */
    public RMLRouteWaypoint(RMLRouteGraph graph, String id, int index) {
        super(index);
        this.id = id;
        graph.registerNode(this);
    }

    /** Returns the node's adjacency list, given a direction */
    public ArrayList<RMLTVDSectionPath> getNeighbors(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return startToStopNeighbors;
        return stopToStartNeighbors;
    }
}
