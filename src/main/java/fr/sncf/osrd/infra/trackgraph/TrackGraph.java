package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.util.graph.Graph;
import fr.sncf.osrd.util.CryoMap;

public final class TrackGraph extends Graph<TrackNode, TrackSection> {
    // operationalPoints a map from operational point IDs to operational points
    public final CryoMap<String, OperationalPoint> operationalPoints = new CryoMap<>();
    // trackNodeMap a map from node IDs to nodes
    public final CryoMap<String, TrackNode> trackNodeMap = new CryoMap<>();
    // trackSectionMap a map to track section IDs to track sections
    public final CryoMap<String, TrackSection> trackSectionMap = new CryoMap<>();


    /**
     * Create a placeholder node
     *
     * @param id the placeholder node ID
     * @return the placeholder node
     */
    public PlaceholderNode makePlaceholderNode(String id) {
        var node = new PlaceholderNode(id);
        this.register(node);
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
     * @return the new track section
     */
    public TrackSection makeTrackSection(
            int startNodeIndex,
            int endNodeIndex,
            String id,
            double length
    ) {
        var edge = TrackSection.linkNodes(
                startNodeIndex,
                endNodeIndex,
                id,
                length
        );
        this.register(edge);
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

    /**
     * Check the validity of the graph
     */
    public void validate() throws InvalidInfraException {
        for (var edge : this.edges) {
            edge.validate();
        }
    }
}
