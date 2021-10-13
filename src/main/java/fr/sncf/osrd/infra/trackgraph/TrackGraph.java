package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.utils.CryoMap;
import fr.sncf.osrd.utils.graph.BiNGraph;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import java.util.List;
import java.util.Map;

public final class TrackGraph extends BiNGraph<TrackSection, TrackNode> {
    // operationalPoints a map from operational point IDs to operational points
    public final CryoMap<String, OperationalPoint> operationalPoints = new CryoMap<>();
    // trackNodeMap a map from node IDs to nodes
    public final CryoMap<String, TrackNode> trackNodeMap = new CryoMap<>();
    // trackSectionMap a map to track section IDs to track sections
    public final CryoMap<String, TrackSection> trackSectionMap = new CryoMap<>();


    /** Create a placeholder node */
    public PlaceholderNode makePlaceholderNode(String id) {
        return makePlaceholderNode(nextNodeIndex(), id);
    }

    /** Create a placeholder node at the given node index */
    public PlaceholderNode makePlaceholderNode(int index, String id) {
        var node = new PlaceholderNode(this, index, id);
        trackNodeMap.put(node.id, node);
        return node;
    }

    /** Create a switch node at the given node index */
    public Switch makeSwitchNode(
            int index,
            String id,
            int switchIndex,
            double groupChangeDelay,
            List<Switch.Port> ports,
            Map<String, List<Switch.PortEdge>> groups
    ) {
        var node = new Switch(
                this,
                index,
                id,
                switchIndex,
                groupChangeDelay,
                ports,
                groups
        );
        trackNodeMap.put(node.id, node);
        return node;
    }

    /**
     * Make a new track section
     *
     * @param startNodeIndex the start node of the track
     * @param endNodeIndex   end end node of the track
     * @param id             the track section ID
     * @param length         the length of the track
     * @param endpointCoords endpoint coordinates
     * @return the new track section
     */
    public TrackSection makeTrackSection(
            int startNodeIndex,
            int endNodeIndex,
            String id,
            double length,
            List<List<Double>> endpointCoords
    ) {
        var edge = new TrackSection(this, nextEdgeIndex(), id, startNodeIndex, endNodeIndex, length, endpointCoords);
        trackSectionMap.put(edge.id, edge);
        return edge;
    }

    /**
     * Makes a new operational point
     *
     * @param id the operational point identifier
     * @return the new operational point
     */
    public OperationalPoint makeOperationalPoint(String id) {
        var op = new OperationalPoint(id);
        operationalPoints.put(id, op);
        return op;
    }


    @Override
    public List<TrackSection> getNeighborRels(TrackSection edge, EdgeEndpoint endpoint) {
        return edge.getNeighbors(endpoint);
    }
}
