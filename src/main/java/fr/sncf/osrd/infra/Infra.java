package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.blocksection.BlockSection;
import fr.sncf.osrd.infra.blocksection.SectionSignalNode;
import fr.sncf.osrd.infra.branching.Branch;
import fr.sncf.osrd.infra.branching.BranchAttrs;
import fr.sncf.osrd.infra.graph.Graph;
import fr.sncf.osrd.infra.topological.NoOpNode;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.infra.topological.TopoNode;
import fr.sncf.osrd.util.CryoFlatMap;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.CryoMap;
import java.util.function.Function;

/**
 * <p>A data structure meant to store the immutable part of a railroad infrastructure.</p>
 *
 * <p>It has a somewhat uncommon data model, closer to graph theory than other railway simulators:</p>
 * <ul>
 *  <li>Edges are pieces of branch</li>
 *  <li>Nodes are intersection points between edges</li>
 *  <li>All elements that do not change the shape of the railway infrastructure are <b>attributes</b> along edges</li>
 *  <li>Each edge belongs to a single branch, which is a contiguous sequence of edges.
 *      Branches store edge attributes</li>
 *  <li>In addition to being mapped to a branch (which is mandatory), edges can belong to one or more tracks,
 *      which are a collection of edges.</li>
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
 *  <li>External branch attributes are computed (elements that were nodes are added as attributes on edges)</li>
 *  <li>For all edges, a cursor inside the external branch attributes is computed and registered (very important)</li>
 *  <li>Call prepare to build caches and freeze the infrastructure</li>
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
 * <p>Block sections are sections of branch delimited by section signals. Unlike the topology graph,
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
public class Infra {
    /**
     * The topology graph.
     * Each TopoEdge can be mapped to a Branch,
     * which stores most of the data in SortedSequences.
     */
    public final Graph<TopoNode, TopoEdge> topoGraph = new Graph<>();
    public final CryoList<Branch> branches = new CryoList<>();

    /** A list mapping all topological edges to a slice of BranchAttrs. */
    private final CryoFlatMap<TopoEdge, BranchAttrs.Slice> topoEdgeAttributes = new CryoFlatMap<>();

    public BranchAttrs.Slice getEdgeAttrs(TopoEdge edge) {
        return topoEdgeAttributes.get(edge.getIndex());
    }

    /**
     * The block sections graph.
     * A block section may span multiple topological edges, and thus be on multiple lines.
     * Each block section has a RangeSequence of the edges it spans over.
     */
    public final Graph<SectionSignalNode, BlockSection> blockSectionsGraph = new Graph<>();

    public final CryoMap<String, Line> lines = new CryoMap<>();

    public void register(TopoNode node) {
        topoGraph.register(node);
    }

    public void register(TopoEdge edge) {
        topoGraph.register(edge);
    }

    public void register(SectionSignalNode node) {
        blockSectionsGraph.register(node);
    }

    public void register(BlockSection edge) {
        blockSectionsGraph.register(edge);
    }

    public void register(Branch branch) {
        branch.setIndex(branches.size());
        branches.add(branch);
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
     * Instanciates and registers a new Line
     * @param name the display name of the line
     * @param id the unique line identifier
     * @return the Line object
     * @throws InvalidInfraException if a line with the same identifier already exists
     */
    public Branch makeBranch(String name, String id) throws InvalidInfraException {
        var branch = new Branch(name, id);
        this.register(branch);
        return branch;
    }

    /**
     * Creates and registers a new topological link.
     * @param startNode The start node of the edge
     * @param startNodeRegister The function to call to register the edge with the start node
     * @param endNode The end node of the edge
     * @param endNodeRegister The function to call to register the edge with the end node
     * @param id A unique identifier for the edge
     * @param length The length of the edge, in meters
     * @return A new edge
     */
    public TopoEdge makeTopoLink(
            TopoNode startNode,
            Function<TopoEdge, TopoNode> startNodeRegister,
            TopoNode endNode,
            Function<TopoEdge, TopoNode> endNodeRegister,
            String id,
            double length,
            Branch branch,
            double startBranchLocation,
            double endBranchLocation
    ) {
        var edge = TopoEdge.link(
                startNode,
                startNodeRegister,
                endNode,
                endNodeRegister,
                id,
                length,
                branch,
                startBranchLocation,
                endBranchLocation
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
     * Pre-compute metadata, and freeze the infrastructure.
     */
    public void prepare() {
        assert topoEdgeAttributes.isEmpty();
        for (var edge : topoGraph.edges) {
            var startPos = edge.startBranchPosition;
            var endPos = edge.endBranchPosition;
            var attrSlice = edge.branch.attributes.slice(startPos, endPos);
            topoEdgeAttributes.add(attrSlice);
        }

        freeze();
    }

    /** Prevent further modifications. */
    private void freeze() {
        // freeze the topological graph
        topoGraph.freeze();
        topoEdgeAttributes.freeze();

        // freeze the block sections graph
        blockSectionsGraph.freeze();

        // miscellaneous
        lines.freeze();
    }
}
