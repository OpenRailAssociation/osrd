package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.blocksection.BlockSection;
import fr.sncf.osrd.infra.blocksection.SectionSignalNode;
import fr.sncf.osrd.infra.graph.Graph;
import fr.sncf.osrd.infra.state.InfraState;
import fr.sncf.osrd.infra.topological.NoOpNode;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.infra.topological.TopoNode;
import fr.sncf.osrd.util.CryoMap;
import fr.sncf.osrd.util.Freezable;

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
public class Infra implements Freezable {
    /**
     * The topology graph.
     */
    public final Graph<TopoNode, TopoEdge> topoGraph = new Graph<>();

    public final CryoMap<String, TopoNode> topoNodeMap = new CryoMap<>();
    public final CryoMap<String, TopoEdge> topoEdgeMap = new CryoMap<>();
    public final CryoMap<String, OperationalPoint> operationalPointMap = new CryoMap<>();

    /**
     * The block sections graph.
     * A block section may span multiple topological edges, and thus be on multiple lines.
     * Each block section has a RangeSequence of the edges it spans over.
     */
    public final Graph<SectionSignalNode, BlockSection> blockSectionsGraph = new Graph<>();

    public final CryoMap<String, Line> lines = new CryoMap<>();

    private boolean frozen = false;

    public void register(TopoNode node) {
        topoGraph.register(node);
        topoNodeMap.put(node.id, node);
    }

    public void register(TopoEdge edge) {
        topoGraph.register(edge);
        topoEdgeMap.put(edge.id, edge);
    }

    public void register(OperationalPoint operationalPoint) {
        operationalPointMap.put(operationalPoint.id, operationalPoint);
    }

    public void register(SectionSignalNode node) {
        blockSectionsGraph.register(node);
    }

    public void register(BlockSection edge) {
        blockSectionsGraph.register(edge);
    }

    /**
     * Registers a new line into the infrastructure, throwing an exception
     * @param line the line to register
     * @throws InvalidInfraException if another line with the same name is already registered
     */
    public void register(Line line) throws InvalidInfraException {
        var previousValue = lines.putIfAbsent(line.id, line);
        if (previousValue != null)
            throw new InvalidInfraException(String.format("Duplicate line %s", line.id));
    }

    /**
     * Instanciates and registers a new Line
     * @param name the display name of the line
     * @param id the unique line identifier
     * @return the Line object
     * @throws InvalidInfraException if a line with the same identifier already exists
     */
    public Line makeLine(String name, String id) throws InvalidInfraException {
        var line = new Line(name, id);
        this.register(line);
        return line;
    }

    /**
     * Creates and registers a new topological link.
     * @param startNodeIndex The index of the start node of the edge
     * @param endNodeIndex The index of the end node of the edge
     * @param id A unique identifier for the edge
     * @param length The length of the edge, in meters
     * @return A new edge
     */
    public TopoEdge makeTopoLink(
            int startNodeIndex,
            int endNodeIndex,
            String id,
            double length
    ) {
        var edge = TopoEdge.link(
                startNodeIndex,
                endNodeIndex,
                id,
                length
        );
        this.register(edge);
        return edge;
    }

    /**
     * Creates and registers a new topological NoOp (No Operation) node.
     * @param id the unique node identifier
     * @return the newly created node
     */
    public NoOpNode makeNoOpNode(String id) {
        var node = new NoOpNode(id);
        this.register(node);
        return node;
    }

    /**
     * Pre-compute metadata, validate and freeze the infrastructure.
     */
    public void prepare() throws InvalidInfraException {
        topoGraph.prepare();

        for (var edge : topoGraph.edges)
            edge.validate();

        freeze();
    }

    /** Prevent further modifications. */
    @Override
    public void freeze() {
        assert !frozen;

        // freeze id to node,edge and op map
        topoNodeMap.freeze();
        topoEdgeMap.freeze();
        operationalPointMap.freeze();

        // freeze the block sections graph
        blockSectionsGraph.freeze();

        // miscellaneous
        lines.freeze();

        frozen = true;
    }

    @Override
    public boolean isFrozen() {
        return frozen;
    }

    InfraState newState() {
        var state = new InfraState(this);
        // TODO: add stateful objects
        // state.initialize(object);
        return state;
    }
}
