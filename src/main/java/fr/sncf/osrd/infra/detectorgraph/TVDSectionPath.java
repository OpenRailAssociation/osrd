package fr.sncf.osrd.infra.detectorgraph;

import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.utils.graph.AbstractEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.utils.graph.Graph;

import java.util.ArrayList;
import java.util.HashSet;

public class TVDSectionPath extends AbstractEdge<DetectorNode, TVDSectionPath> {

    public final EdgeDirection startNodeDirection;
    public final EdgeDirection endNodeDirection;
    public final HashSet<String> tvdSections = new HashSet<>();

    public EdgeDirection nodeDirection(EdgeEndpoint endpoint) {
        return endpoint == EdgeEndpoint.BEGIN ? startNodeDirection : endNodeDirection;
    }

    public DetectorNode getNode(EdgeEndpoint endpoint, Graph<DetectorNode, TVDSectionPath> graph) {
        var nodeID = endpoint == EdgeEndpoint.BEGIN ? startNode : endNode;
        return graph.nodes.get(nodeID);
    }

    @Override
    public ArrayList<TVDSectionPath> getNeighbors(EdgeEndpoint endpoint, Graph<DetectorNode, TVDSectionPath> graph) {
        if (nodeDirection(endpoint) == EdgeDirection.START_TO_STOP) {
            return getNode(endpoint, graph).startToStopNeighbors;
        }
        return getNode(endpoint, graph).stopToStartNeighbors;
    }

    TVDSectionPath(int startNode, int endNode, double length, EdgeDirection startNodeDirection,
                   EdgeDirection endNodeDirection) {
        super(startNode, endNode, length);
        this.startNodeDirection = startNodeDirection;
        this.endNodeDirection = endNodeDirection;
    }
}
