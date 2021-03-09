package fr.sncf.osrd.railml.routegraph;

import static fr.sncf.osrd.utils.graph.EdgeDirection.START_TO_STOP;

import fr.sncf.osrd.utils.graph.BiNGraph;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.utils.graph.UndirectedBiEdgeID;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class RMLRouteGraph extends BiNGraph<RMLTVDSectionPath, RMLRouteWaypoint> {
    public final HashMap<String, RMLRouteWaypoint> waypointsMap = new HashMap<>();
    // TVDSectionPath are identified by the couple (StartNode, EndNode)
    public final HashMap<UndirectedBiEdgeID, RMLTVDSectionPath> tvdSectionPathMap = new HashMap<>();
    public final HashMap<Integer, ArrayList<RMLTVDSectionPath>> waypointToTvdSectionPath = new HashMap<>();

    @Override
    public void registerEdge(RMLTVDSectionPath edge) {
        super.registerEdge(edge);
        // Add edge to the list of waypoint edges
        var list = waypointToTvdSectionPath.computeIfAbsent(edge.startNode, k -> new ArrayList<>());
        list.add(edge);
        list = waypointToTvdSectionPath.computeIfAbsent(edge.endNode, k -> new ArrayList<>());
        list.add(edge);
    }

    @Override
    public List<RMLTVDSectionPath> getNeighborRels(
            RMLTVDSectionPath edge,
            EdgeEndpoint endpoint
    ) {
        var nodeIndex = endpoint == EdgeEndpoint.BEGIN ? edge.startNode : edge.endNode;
        var node = getNode(nodeIndex);

        if (edge.nodeDirection(endpoint) == START_TO_STOP)
            return node.startToStopNeighbors;
        return node.stopToStartNeighbors;
    }

    public RMLTVDSectionPath getTVDSectionPath(int startNode, int endNode) {
        return tvdSectionPathMap.get(UndirectedBiEdgeID.from(startNode, endNode));
    }
}
