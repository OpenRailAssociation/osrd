package fr.sncf.osrd.infra.detectorgraph;

import fr.sncf.osrd.utils.graph.AbstractBiEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.utils.graph.AbstractBiGraph;

import java.util.ArrayList;
import java.util.HashSet;

public class TVDSectionPath extends AbstractBiEdge<DetectorNode, TVDSectionPath> {
    /** The direction to the inside of the TVDSection from the start node, relative to the TrackSection */
    public final EdgeDirection startNodeDirection;
    /** The direction to the inside of the TVDSection from the end node, relative to the TrackSection */
    public final EdgeDirection endNodeDirection;
    public final HashSet<String> tvdSections = new HashSet<>();

    public EdgeDirection nodeDirection(EdgeEndpoint endpoint) {
        return endpoint == EdgeEndpoint.BEGIN ? startNodeDirection : endNodeDirection;
    }

    TVDSectionPath(
            DetectorGraph graph,
            int startNode,
            EdgeDirection startNodeDirection,
            int endNode,
            EdgeDirection endNodeDirection,
            double length
    ) {
        super(graph.nextEdgeIndex(), startNode, endNode, length);
        graph.registerEdge(this);
        this.startNodeDirection = startNodeDirection;
        this.endNodeDirection = endNodeDirection;
    }
}
