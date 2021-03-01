package fr.sncf.osrd.infra.waypointgraph;

import fr.sncf.osrd.utils.graph.Node;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;

public class WaypointNode extends Node {
    /** List of neighbors seen when moving across the detector from the end of the track section to the beginning */
    public final ArrayList<TVDSectionPath> startToStopNeighbors = new ArrayList<>();

    /** List of neighbors seen when moving across the detector from the beginning of the track section to the end */
    public final ArrayList<TVDSectionPath> stopToStartNeighbors = new ArrayList<>();

    public WaypointNode(WaypointGraph graph, int index) {
        super(index);
        graph.registerNode(this);
    }

    /** Returns the node's adjacency list, given a direction */
    public ArrayList<TVDSectionPath> getNeighbors(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return startToStopNeighbors;
        return stopToStartNeighbors;
    }
}
