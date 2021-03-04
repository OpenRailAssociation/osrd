package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.signaling.Signal;
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
    public final RouteGraph routeGraph;
    public final HashMap<String, TVDSection> tvdSections;
    public final HashMap<String, Aspect> aspects;
    public final ArrayList<Signal> signals;

    /**
     * Create an OSRD Infra
     * @param trackGraph the track graph
     * @param waypointGraph the waypoint graph
     * @param routeGraph the route graph
     * @param tvdSections the list of TVDSection
     * @param aspects the list of valid signal aspects
     * @throws InvalidInfraException {@inheritDoc}
     */
    public Infra(
            TrackGraph trackGraph,
            WaypointGraph waypointGraph,
            RouteGraph routeGraph,
            HashMap<String, TVDSection> tvdSections,
            HashMap<String, Aspect> aspects,
            ArrayList<Signal> signals
    ) throws InvalidInfraException {
        this.trackGraph = trackGraph;
        this.routeGraph = routeGraph;
        this.tvdSections = tvdSections;
        this.aspects = aspects;
        this.signals = signals;
        this.trackGraph.validate();
        this.waypointGraph = waypointGraph;
    }

    /**
     * Build a the WaypointGraph once track graph is filled
     */
    public static WaypointGraph buildWaypointGraph(TrackGraph trackGraph, HashMap<String, TVDSection> tvdSections) {
        var waypointGraph = WaypointGraph.buildDetectorGraph(trackGraph);
        linkTVDSectionToPath(waypointGraph, tvdSections);
        return waypointGraph;
    }

    /**
     * Link TVD Sections with TVDSectionPath of a given detectorGraph
     * Each TVDSection references TVDSectionPaths, and reciprocally.
     */
    private static void linkTVDSectionToPath(WaypointGraph waypointGraph, HashMap<String, TVDSection> tvdSections) {
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
                    var tvdSection = tvdSections.get(tvdID);
                    tvdSectionPath.tvdSections.add(tvdSection);
                    tvdSection.sections.add(tvdSectionPath);
                }
            }
        }
    }

    public static final class State {
        public final Infra infra;

        private final Signal.State[] signalStates;
        private final Route.State[] routeStates;

        private State(Infra infra, Signal.State[] signalStates, Route.State[] routeStates) {
            this.infra = infra;
            this.signalStates = signalStates;
            this.routeStates = routeStates;
        }

        public Signal.State getState(Signal signal) {
            return signalStates[signal.index];
        }

        public Route.State getState(Route route) {
            return routeStates[route.index];
        }

        /** Initializes a state for the infrastructure */
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST_OF_RETURN_VALUE"})
        public static State from(Infra infra) {
            // create a new state for each signal
            var signalCount = infra.signals.size();
            var signalStates = new Signal.State[signalCount];
            for (int i = 0; i < signalCount; i++)
                signalStates[i] = infra.signals.get(i).newState();

            var routeCount = infra.routeGraph.getEdgeCount();
            var routeStates = new Route.State[routeCount];
            for (int i = 0; i < signalCount; i++)
                routeStates[i] = infra.routeGraph.getEdge(i).newState();

            // TODO: initialize the state of the signals
            return new State(infra, signalStates, routeStates);
        }
    }
}
