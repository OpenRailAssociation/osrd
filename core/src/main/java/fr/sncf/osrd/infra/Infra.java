package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.railscript.DependencyBinder;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import okio.Okio;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;

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
    public final RouteGraph routeGraph;
    public final HashMap<String, TVDSection> tvdSections;
    public final HashMap<String, Aspect> aspects;
    public final ArrayList<Signal> signals;
    public final ArrayList<Switch> switches;

    private Infra(
            TrackGraph trackGraph,
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
    }

    /** Create an OSRD Infra */
    public static Infra build(
            TrackGraph trackGraph,
            RouteGraph routeGraph,
            HashMap<String, TVDSection> tvdSections,
            HashMap<String, Aspect> aspects,
            ArrayList<Signal> signals,
            ArrayList<Switch> switches
    ) throws InvalidInfraException {
        var infra = new Infra(trackGraph, routeGraph, tvdSections, aspects, signals, switches);

        for (var trackSection : trackGraph.iterEdges()) {
            var forwardBuilder = trackSection.forwardActionPoints.builder();
            var backwardBuilder = trackSection.backwardActionPoints.builder();

            for (var signal : trackSection.signals) {
                if (signal.value.direction == EdgeDirection.START_TO_STOP)
                    forwardBuilder.add(signal.position, signal.value);
                if (signal.value.direction == EdgeDirection.STOP_TO_START)
                    backwardBuilder.add(signal.position, signal.value);
            }
            for (var waypoint : trackSection.waypoints) {
                forwardBuilder.add(waypoint.position, waypoint.value);
                backwardBuilder.add(waypoint.position, waypoint.value);
            }
            trackSection.operationalPoints.forEach(op -> {
                        forwardBuilder.add(op.position, op.value);
                        backwardBuilder.add(op.position, op.value);
                    }
            );
            forwardBuilder.build();
            backwardBuilder.build();
        }

        routeGraph.routeMap.values().forEach(Route::resolveSignals);
        signals.forEach(signal -> DependencyBinder.bind(signal, infra));

        // Evaluate initial aspects of signals
        var topologicalSignalOrder = buildTopologicalSignalOrder(signals);
        var initialState = InfraState.from(infra);
        for (var signal : topologicalSignalOrder) {
            signal.evalInitialAspect(initialState);
        }

        return infra;
    }

    private static ArrayList<Signal> buildTopologicalSignalOrder(
            ArrayList<Signal> signals
    ) throws InvalidInfraException {
        var order = new ArrayList<Signal>();
        var indeg = new int[signals.size()];
        for (Signal signal : signals) {
            for (var neighbor : signal.signalSubscribers)
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
            for (var neighbor : node.signalSubscribers) {
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

    /** Parse the RailJSON file at the given Path */
    @SuppressFBWarnings(
            value = "RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE",
            justification = "that's a spotbugs bug :)"
    )
    public static RJSInfra parseRailJSONFromFile(
            JsonConfig.InfraType infraType,
            String path
    ) throws InvalidInfraException, IOException {
        // autodetect the infrastructure type
        if (infraType == null || infraType == JsonConfig.InfraType.UNKNOWN) {
            if (path.endsWith(".json"))
                infraType = JsonConfig.InfraType.RAILJSON;
            else
                infraType = JsonConfig.InfraType.UNKNOWN;
        }

        switch (infraType) {
            case RAILJSON:
                try (
                        var fileSource = Okio.source(Path.of(path));
                        var bufferedSource = Okio.buffer(fileSource)
                ) {
                    var rjsRoot = RJSInfra.adapter.fromJson(bufferedSource);
                    assert rjsRoot != null;
                    return rjsRoot;
                }
            default:
                throw new RuntimeException("invalid infrastructure type value");
        }
    }

    /** Load an infra from a given RailML or RailJSON file */
    @SuppressFBWarnings(
            value = "RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE",
            justification = "that's a spotbugs bug :)"
    )
    public static Infra parseFromFile(
            JsonConfig.InfraType infraType,
            String path
    ) throws InvalidInfraException, IOException {
        var rjsInfra = parseRailJSONFromFile(infraType, path);
        return RailJSONParser.parse(rjsInfra);
    }
}
