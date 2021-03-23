package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.waypointgraph.WaypointGraph;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railml.RailMLParser;
import fr.sncf.osrd.utils.DeepEqualsUtils;
import fr.sncf.osrd.utils.DeepComparable;
import fr.sncf.osrd.utils.SortedArraySet;
import okio.Okio;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Objects;

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
    public final ArrayList<Switch> switches;

    private Infra(
            TrackGraph trackGraph,
            WaypointGraph waypointGraph,
            RouteGraph routeGraph,
            HashMap<String, TVDSection> tvdSections,
            HashMap<String, Aspect> aspects,
            ArrayList<Signal> signals,
            ArrayList<Switch> switches
    ) {
        this.trackGraph = trackGraph;
        this.routeGraph = routeGraph;
        this.tvdSections = tvdSections;
        this.aspects = aspects;
        this.signals = signals;
        this.switches = switches;
        this.waypointGraph = waypointGraph;
    }

    /** Create an OSRD Infra */
    public static Infra build(
            TrackGraph trackGraph,
            WaypointGraph waypointGraph,
            RouteGraph routeGraph,
            HashMap<String, TVDSection> tvdSections,
            HashMap<String, Aspect> aspects,
            ArrayList<Signal> signals,
            ArrayList<Switch> switches
    ) throws InvalidInfraException {
        var infra = new Infra(trackGraph, waypointGraph, routeGraph, tvdSections, aspects, signals, switches);
        infra.trackGraph.validate();

        for (var trackSection : trackGraph.iterEdges()) {
            @SuppressWarnings("unchecked")
            var forwardBuilder = trackSection.interactablesForward.builder();
            var backwardBuilder = trackSection.interactablesBackward.builder();

            for (var signal : trackSection.signals) {
                if (signal.value.direction.appliesToNormal())
                    forwardBuilder.add(signal.position, signal.value);
                if (signal.value.direction.appliesToReverse())
                    backwardBuilder.add(signal.position, signal.value);
            }
            for (var waypoint : trackSection.waypoints) {
                forwardBuilder.add(waypoint.position, waypoint.value);
                backwardBuilder.add(waypoint.position, waypoint.value);
            }
            forwardBuilder.build();
            backwardBuilder.build();
        }

        // Evaluate initial aspects of signals
        var topologicalSignalOrder = buildTopologicalSignalOrder(signals);
        var initialState = infra.createInitialState();
        for (var i = topologicalSignalOrder.size() - 1; i >= 0; i--)
            signals.get(topologicalSignalOrder.get(i).index).evalInitialAspect(initialState);

        return infra;
    }

    /**
     * Build a the WaypointGraph once track graph is filled
     */
    public static WaypointGraph buildWaypointGraph(
            TrackGraph trackGraph, HashMap<String,
            TVDSection> tvdSections
    ) throws InvalidInfraException {
        var waypointGraph = WaypointGraph.buildDetectorGraph(trackGraph);
        linkTVDSectionToPath(waypointGraph, tvdSections);
        return waypointGraph;
    }

    private static ArrayList<Signal> buildTopologicalSignalOrder(
            ArrayList<Signal> signals
    ) throws InvalidInfraException {
        var order = new ArrayList<Signal>();
        var indeg = new int[signals.size()];
        for (Signal signal : signals) {
            for (var neighbor : signal.signalDependencies)
                indeg[neighbor.index] += 1;
        }

        var toVisit = new ArrayList<Signal>();
        for (var node = 0; node < signals.size(); node++) {
            if (indeg[node] == 0)
                toVisit.add(signals.get(node));
        }

        while (!toVisit.isEmpty()) {
            var node = toVisit.remove(toVisit.size() - 1); // pop()
            order.add(node);
            for (var neighbor : node.signalDependencies) {
                indeg[neighbor.index] -= 1;
                if (indeg[neighbor.index] == 0)
                    toVisit.add(neighbor);
            }
        }

        for (var deg : indeg) {
            if (deg != 0)
                throw new InvalidInfraException("The signal dependency graph has a cycle.");
        }

        return order;
    }

    /**
     * Link TVD Sections with TVDSectionPath of a given detectorGraph
     * Each TVDSection references TVDSectionPaths, and reciprocally.
     */
    private static void linkTVDSectionToPath(
            WaypointGraph waypointGraph,
            HashMap<String, TVDSection> tvdSections
    ) throws InvalidInfraException {
        // Initialize reverse map DetectorNode -> TVDSections
        var nbDetector = waypointGraph.getNodeCount();
        var detectorNodeToTVDSections = new ArrayList<SortedArraySet<TVDSection>>(nbDetector);
        for (int i = 0; i < nbDetector; i++)
            detectorNodeToTVDSections.add(new SortedArraySet<>());
        for (var tvdSection : tvdSections.values()) {
            for (var waypoint : tvdSection.waypoints) {
                var nodeIndex = waypointGraph.waypointNodeMap.get(waypoint.id).index;
                detectorNodeToTVDSections.get(nodeIndex).add(tvdSection);
            }
        }

        // Compute which TVDSection belongs to each TVDSectionPath
        for (var tvdSectionPath : waypointGraph.tvdSectionPathMap.values()) {
            // Set intersection
            var tvdSectionsStart = detectorNodeToTVDSections.get(tvdSectionPath.startNode);
            var tvdSectionsEnd = detectorNodeToTVDSections.get(tvdSectionPath.endNode);
            var tvdSectionIntersection = tvdSectionsStart.intersect(tvdSectionsEnd);
            // Check only one tvd section is in the intersection
            if (tvdSectionIntersection.size() != 1) {
                throw new InvalidInfraException(String.format(
                        "Tvd section path have %d tvd section available. Should be 1.",
                        tvdSectionIntersection.size()));
            }
            // Fill data structures
            var tvdSection = tvdSectionIntersection.get(0);
            tvdSectionPath.tvdSection = tvdSection;
            tvdSection.sections.add(tvdSectionPath);
        }
    }

    /** Initializes a state for the infrastructure */
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST_OF_RETURN_VALUE"})
    public State createInitialState() {
        var signalCount = signals.size();
        var signalStates = new Signal.State[signalCount];
        for (int i = 0; i < signalCount; i++)
            signalStates[i] = signals.get(i).newState();

        var routeCount = routeGraph.getEdgeCount();
        var routeStates = new Route.State[routeCount];
        for (int i = 0; i < routeCount; i++)
            routeStates[i] = routeGraph.getEdge(i).newState();

        var switchCount = switches.size();
        var switchStates = new Switch.State[switchCount];
        for (var infraSwitch : switches)
            switchStates[infraSwitch.switchIndex] = infraSwitch.newState();

        var tvdSectionCount = tvdSections.size();
        var tvdSectionStates = new TVDSection.State[tvdSectionCount];
        for (var tvdSection : tvdSections.values())
            tvdSectionStates[tvdSection.index] = tvdSection.newState();

        var state = new State(signalStates, routeStates, switchStates, tvdSectionStates);

        // Initialize entities
        for (var signal : signalStates)
            signal.initialize(state);

        for (var route : routeStates)
            route.initialize(state);

        return state;
    }

    public static final class State implements DeepComparable<State> {
        private final Signal.State[] signalStates;
        private final Route.State[] routeStates;
        private final Switch.State[] switchStates;
        private final TVDSection.State[] tvdSectionStates;

        private State(
                Signal.State[] signalStates,
                Route.State[] routeStates,
                Switch.State[] switchStates,
                TVDSection.State[] tvdSectionStates) {
            this.signalStates = signalStates;
            this.routeStates = routeStates;
            this.switchStates = switchStates;
            this.tvdSectionStates = tvdSectionStates;
        }

        public Signal.State getSignalState(int signalIndex) {
            return signalStates[signalIndex];
        }

        public Route.State getRouteState(int routeIndex) {
            return routeStates[routeIndex];
        }


        public Switch.State getSwitchState(int switchIndex) {
            return switchStates[switchIndex];
        }

        public TVDSection.State getTvdSectionState(int tvdSectionIndex) {
            return tvdSectionStates[tvdSectionIndex];
        }

        @Override
        public boolean deepEquals(Infra.State otherState) {
            if (!DeepEqualsUtils.deepEquals(signalStates, otherState.signalStates))
                return false;
            if (!DeepEqualsUtils.deepEquals(routeStates, otherState.routeStates))
                return false;
            if (!DeepEqualsUtils.deepEquals(switchStates, otherState.switchStates))
                return false;
            return DeepEqualsUtils.deepEquals(tvdSectionStates, otherState.tvdSectionStates);
        }
    }

    /** Load an infra from a given RailML or RailJSON file */
    @SuppressFBWarnings({"RCN_REDUNDANT_NULLCHECK_WOULD_HAVE_BEEN_A_NPE"})
    public static Infra parseFromFile(
            JsonConfig.InfraType infraType,
            String path
    ) throws InvalidInfraException, IOException {
        // autodetect the infrastructure type
        if (infraType == null || infraType == JsonConfig.InfraType.UNKNOWN) {
            if (path.endsWith(".json"))
                infraType = JsonConfig.InfraType.RAILJSON;
            else if (path.endsWith(".xml"))
                infraType = JsonConfig.InfraType.RAILML;
            else
                infraType = JsonConfig.InfraType.UNKNOWN;
        }

        switch (infraType) {
            case RAILML: {
                var rjsRoot = RailMLParser.parse(path);
                return RailJSONParser.parse(rjsRoot);
            }
            case RAILJSON:
                try (
                        var fileSource = Okio.source(Path.of(path));
                        var bufferedSource = Okio.buffer(fileSource)
                ) {
                    var rjsRoot = RJSInfra.adapter.fromJson(bufferedSource);
                    return RailJSONParser.parse(rjsRoot);
                }
            default:
                throw new RuntimeException("invalid infrastructure type value");
        }
    }
}
