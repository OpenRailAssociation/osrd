package fr.sncf.osrd.railml.routegraph;

import fr.sncf.osrd.utils.graph.BiNEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;

public class RMLTVDSectionPath extends BiNEdge<RMLTVDSectionPath> {
    /** The direction to the inside of the TVDSection from the start node, relative to the TrackSection */
    public final EdgeDirection startNodeDirection;
    /** The direction to the inside of the TVDSection from the end node, relative to the TrackSection */
    public final EdgeDirection endNodeDirection;

    public EdgeDirection nodeDirection(EdgeEndpoint endpoint) {
        return endpoint == EdgeEndpoint.BEGIN ? startNodeDirection : endNodeDirection;
    }

    RMLTVDSectionPath(
            RMLRouteGraph graph,
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
