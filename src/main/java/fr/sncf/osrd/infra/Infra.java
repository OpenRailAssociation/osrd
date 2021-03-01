package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.waypointgraph.WaypointGraph;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.simulation.Entity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.function.Consumer;

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
    public final TrackGraph trackGraph;
    public final WaypointGraph waypointGraph;
    public final HashMap<String, TVDSection> tvdSections;
    public final HashMap<String, Aspect> aspects;

    /**
     * Create an OSRD Infra
     * @param trackGraph the track graph
     * @param waypointGraph the waypoint graph
     * @param tvdSections the list of TVDSection
     * @param aspects the list of valid signal aspects
     * @throws InvalidInfraException {@inheritDoc}
     */
    public Infra(
            TrackGraph trackGraph,
            WaypointGraph waypointGraph,
            HashMap<String, TVDSection> tvdSections,
            HashMap<String, Aspect> aspects
    ) throws InvalidInfraException {
        this.trackGraph = trackGraph;
        this.tvdSections = tvdSections;
        this.aspects = aspects;
        this.trackGraph.validate();
        this.waypointGraph = waypointGraph;
    }

    public void forAllStatefulObjects(Consumer<StatefulInfraObject<?>> callback) {
        // TODO: when signals and routes are parsed, add those here
    }

    /**
     * A helper to help build Infra instances.
     */
    public static class Builder {
        public final TrackGraph trackGraph = new TrackGraph();
        public final HashMap<String, TVDSection> tvdSections = new HashMap<>();
        public final HashMap<String, Aspect> aspects = new HashMap<>();

        /**
         * Build a new Infra from the given constructed trackGraph and tvdSections
         */
        public Infra build() throws InvalidInfraException {
            var detectorGraph = WaypointGraph.buildDetectorGraph(trackGraph);
            linkTVDSectionToPath(detectorGraph);
            return new Infra(trackGraph, detectorGraph, tvdSections, aspects);
        }

        /**
         * Link TVD Sections with TVDSectionPath of a given detectorGraph
         * Each TVDSection references TVDSectionPaths, and reciprocally.
         */
        private void linkTVDSectionToPath(WaypointGraph waypointGraph) {
            // Initialize reverse map DetectorNode -> TVDSections
            var nbDetector = waypointGraph.getNodeCount();
            var detectorNodeToTVDSections = new ArrayList<HashSet<String>>(nbDetector);
            for (int i = 0; i < nbDetector; i++)
                detectorNodeToTVDSections.add(new HashSet<>());
            for (var tvdEntry : tvdSections.entrySet()) {
                for (var waypoint : tvdEntry.getValue().waypoints) {
                    var nodeIndex = waypointGraph.waypointNodeMap.get(waypoint.id).index;
                    detectorNodeToTVDSections.get(nodeIndex).add(tvdEntry.getKey());
                }
            }

            // Compute which TVDSection belongs to each TVDSectionPath
            for (var tvdSectionPath : waypointGraph.tvdSectionPathMap.values()) {
                // Set intersection
                var tvdNodeStart = detectorNodeToTVDSections.get(tvdSectionPath.startNode);
                for (var tvdID : detectorNodeToTVDSections.get(tvdSectionPath.endNode)) {
                    if (tvdNodeStart.contains(tvdID)) {
                        tvdSectionPath.tvdSections.add(tvdID);
                        tvdSections.get(tvdID).sections.add(tvdSectionPath);
                    }
                }
            }
        }
    }

    public static final class State {
        public final Infra infra;

        public final HashMap<StatefulInfraObject<?>, Entity> stateMap;

        /** Creates a new infrastructure state */
        public State(Infra infra) {
            this.infra = infra;
            this.stateMap = new HashMap<>();
            infra.forAllStatefulObjects(obj -> {
                var objState = obj.newState();
                stateMap.put(obj, objState);
            });

            for (var entity : stateMap.values())
                entity.initialize();
        }
    }
}
