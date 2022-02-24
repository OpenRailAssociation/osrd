package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.graph.BiNGraph;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class TrackGraph extends BiNGraph<TrackSection, TrackNode> {
    // operationalPoints a map from operational point IDs to operational points
    public final Map<String, OperationalPoint> operationalPoints = new HashMap<>();
    // trackNodeMap a map from node IDs to nodes
    public final Map<String, TrackNode> trackNodeMap = new HashMap<>();
    // trackSectionMap a map to track section IDs to track sections
    public final Map<String, TrackSection> trackSectionMap = new HashMap<>();


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
     * @param geo            geographic geometry
     * @param sch            schematic geometry
     * @return the new track section
     */
    public TrackSection makeTrackSection(
            int startNodeIndex,
            int endNodeIndex,
            String id,
            double length,
            LineString geo,
            LineString sch
    ) {
        var edge = new TrackSection(this, nextEdgeIndex(), id, startNodeIndex, endNodeIndex, length, geo, sch);
        trackSectionMap.put(edge.id, edge);
        return edge;
    }

    public TrackSection makeTrackSection(
            int startNodeIndex,
            int endNodeIndex,
            String id,
            double length
    ) {
        return makeTrackSection(startNodeIndex, endNodeIndex, id, length, null, null);
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
