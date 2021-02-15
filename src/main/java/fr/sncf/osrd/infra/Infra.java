package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.Graph;
import fr.sncf.osrd.infra.trackgraph.PlaceholderNode;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.TrackNode;
import fr.sncf.osrd.util.CryoMap;

/**
 * <p>A data structure meant to store the immutable part of a railroad infrastructure.</p>
 *
 * <p>It has a somewhat uncommon data model, closer to graph theory than other railway simulators:</p>
 * <ul>
 *  <li>Edges are pieces of tracks</li>
 *  <li>Nodes are intersection points between edges</li>
 *  <li>All elements that do not change the shape of the railway infrastructure are <b>attributes</b> along edges</li>
 *  <li>Each edge has a direction, and stores arrays of attributes</li>
 *  <li>Edges can belong to one or more tracks, which are a collection of edges.</li>
 *  <li>Tracks can be part of a line</li>
 *  <li>Block sections are an entirely separate graph</li>
 * </ul>
 *
 * <p>An Infra is meant to be built as follows:</p>
 * <ol>
 *  <li>Lines and tracks are created and registered</li>
 *  <li>The topological nodes as registered first</li>
 *  <li>The topological edges are registered with the nodes, and with the infrastructure</li>
 *  <li>Section signals are registered</li>
 *  <li>Block sections are registered</li>
 *  <li>Edge attributes are computed (elements that were nodes are added as attributes on edges)</li>
 *  <li>Call prepare() to build caches and freeze the infrastructure</li>
 * </ol>
 *
 * <h1>Building a topological graph</h1>
 * <p>A topological graph is a special kind of graph, where there can't be a
 * node that changes the shape of the graph. For example, the following graph:</p>
 *
 * <pre>
 * {@code
 *  a       b     c
 *   +------+----+
 *   |           |
 *   +-----------+
 *  d             e
 * }
 * </pre>
 *
 * <p>Isn't a topological graph, as the shape of the graph wouldn't change if {@code b}
 * weren't here. The issue can be fixed by removing the excess node, and storing the associated
 * data, such as slope, the position of a section signal, or a speed limit, into an attribute
 * of the new edge.</p>
 *
 * <p>There an edge case where a seemingly useless node should be preserved: sometimes,
 * a line has two names (or identifiers), and there needs to be a node to model this, as each
 * edge can only be on a single line.</p>
 *
 * <h1>Block sections</h1>
 * <p>Block sections are sections of track delimited by section signals. Unlike the topology graph,
 * the block section graph is kind of directed: where you can go depends on the edge you're coming
 * from. Consider the following example:</p>
 *
 * <pre>
 * {@code
 *             s b
 *            /
 *   a s-----=----s c
 * }
 * </pre>
 * <p>Each {@code s} is a signal delimiting block sections, and the {@code =} is a switch.
 * Because of the way switches work, you can't go from {@code b} to {@code c}, nor from
 * {@code c} to {@code b}, even though any other path would work.</p>
 *
 * <p>We decided to model it using <b>per-edge neighbours</b>: each end of the block section
 * can be connected to other block sections, even though it's also connected to a signal.</p>
 */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class Infra {
    public final Graph<TrackNode, TrackSection> trackGraph;

    public final CryoMap<String, TrackNode> trackNodeMap;
    public final CryoMap<String, TrackSection> trackSectionMap;
    public final CryoMap<String, OperationalPoint> operationalPointMap;

    /**
     * Create an OSRD Infra
     * @param trackGraph the track graph
     * @param trackNodeMap a map from node IDs to nodes
     * @param trackSectionMap a map to track section IDs to track sections
     * @param operationalPoints a map from operational point IDs to operational points
     * @throws InvalidInfraException {@inheritDoc}
     */
    public Infra(
            Graph<TrackNode, TrackSection> trackGraph,
            CryoMap<String, TrackNode> trackNodeMap,
            CryoMap<String, TrackSection> trackSectionMap,
            CryoMap<String, OperationalPoint> operationalPoints
    ) throws InvalidInfraException {
        this.trackGraph = trackGraph;

        for (var node : trackGraph.nodes)
            node.freeze();
        trackNodeMap.freeze();
        this.trackNodeMap = trackNodeMap;

        for (var edge : trackGraph.edges) {
            edge.validate();
            edge.freeze();
        }
        trackSectionMap.freeze();
        this.trackSectionMap = trackSectionMap;

        operationalPoints.freeze();
        this.operationalPointMap = operationalPoints;
    }

    /**
     * A helper to help build Infra instances.
     */
    public static class Builder {
        public final Graph<TrackNode, TrackSection> trackGraph = new Graph<>();
        public final CryoMap<String, OperationalPoint> operationalPoints = new CryoMap<>();
        public final CryoMap<String, TrackNode> trackNodeMap = new CryoMap<>();
        public final CryoMap<String, TrackSection> trackSectionMap = new CryoMap<>();

        /**
         * Create a placeholder node
         * @param id the placeholder node ID
         * @return the placeholder node
         */
        public PlaceholderNode makePlaceholderNode(String id) {
            var node = new PlaceholderNode(id);
            trackGraph.register(node);
            trackNodeMap.put(node.id, node);
            return node;
        }

        /**
         * Make a new track section
         * @param startNodeIndex the start node of the track
         * @param endNodeIndex end end node of the track
         * @param id the track section ID
         * @param length the length of the track
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
            trackGraph.register(edge);
            trackSectionMap.put(edge.id, edge);
            return edge;
        }

        /**
         * Makes a new operational point
         * @param id the operational point identifier
         * @param name the name of the identifier
         * @return the new operational point
         */
        public OperationalPoint makeOperationalPoint(String id, String name) {
            var op = new OperationalPoint(id, name);
            operationalPoints.put(id, op);
            return op;
        }

        public Infra build() throws InvalidInfraException {
            return new Infra(trackGraph, trackNodeMap, trackSectionMap, operationalPoints);
        }
    }
}
