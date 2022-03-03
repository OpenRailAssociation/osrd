package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import okio.Okio;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;

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
    public final ArrayList<TVDSection> tvdSections;
    public final ArrayList<Signal> signals;
    public final ArrayList<Switch> switches;

    private Infra(
            TrackGraph trackGraph,
            RouteGraph routeGraph,
            ArrayList<TVDSection> tvdSections,
            ArrayList<Signal> signals,
            ArrayList<Switch> switches
    ) {
        this.trackGraph = trackGraph;
        this.routeGraph = routeGraph;
        this.tvdSections = tvdSections;
        this.signals = signals;
        this.switches = switches;
    }

    /** Create an OSRD Infra */
    public static Infra build(
            TrackGraph trackGraph,
            RouteGraph routeGraph,
            ArrayList<TVDSection> tvdSections,
            ArrayList<Signal> signals,
            ArrayList<Switch> switches
    ) throws InvalidInfraException {
        return new Infra(trackGraph, routeGraph, tvdSections, signals, switches);
    }


    /** Parse the RailJSON file at the given Path */
    @SuppressFBWarnings(
            value = "RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE",
            justification = "that's a spotbugs bug :)"
    )
    public static RJSInfra parseRailJSONFromFile(String path) throws IOException {
        try (
                var fileSource = Okio.source(Path.of(path));
                var bufferedSource = Okio.buffer(fileSource)
        ) {
            var rjsRoot = RJSInfra.adapter.fromJson(bufferedSource);
            assert rjsRoot != null;
            return rjsRoot;
        }
    }

    /** Load an infra from a given RailML or RailJSON file */
    @SuppressFBWarnings(
            value = "RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE",
            justification = "that's a spotbugs bug :)"
    )
    public static Infra parseFromFile(String path) throws InvalidInfraException, IOException {
        var rjsInfra = parseRailJSONFromFile(path);
        return RailJSONParser.parse(rjsInfra);
    }
}
