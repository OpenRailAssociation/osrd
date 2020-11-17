package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.blocksection.BlockSection;
import fr.sncf.osrd.infra.blocksection.SectionSignalNode;
import fr.sncf.osrd.infra.topological.NoOpNode;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.infra.topological.TopoNode;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.CryoMap;
import fr.sncf.osrd.util.Freezable;
import java.util.function.Consumer;

/**
 * A data structure meant to store the immutable part of a railroad infrastructure.
 *
 * <p>It's meant to be built as follows:</p>
 * <ol>
 *  <li>Lines and tracks are created and registered</li>
 *  <li>The topological nodes as registered first</li>
 *  <li>The topological edges are registered with the node, and with the infrastructure</li>
 *  <li>Section signals are registered</li>
 *  <li>block sections are registered</li>
 *  <li>external track attributes are computed (elements that were nodes are added as attributes on edges)</li>
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
     * Each TopoEdge contains a reference to a Track,
     * which stores most of the data in SortedSequences.
     */
    public final CryoList<TopoNode> topoNodes = new CryoList<>();
    public final CryoList<TopoEdge> topoEdges = new CryoList<>();

    /**
     * The block sections graph.
     * A block section may span multiple topological edges, and thus be on multiple lines.
     * Each block section has a StairSequence of the edges it spans over.
     */
    public final CryoList<SectionSignalNode> sectionSignals = new CryoList<>();
    public final CryoList<BlockSection> blockSections = new CryoList<>();

    public final CryoMap<String, Line> lines = new CryoMap<>();

    public void register(TopoNode node) {
        node.setIndex(topoNodes.size());
        topoNodes.add(node);
    }

    public void register(TopoEdge edge) {
        edge.setIndex(topoEdges.size());
        topoEdges.add(edge);
    }

    void register(SectionSignalNode node) {
        node.setIndex(sectionSignals.size());
        sectionSignals.add(node);
    }

    void register(BlockSection edge) {
        edge.setIndex(blockSections.size());
        blockSections.add(edge);
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
     * @param startNode The start node of the edge
     * @param startNodeRegister The function to call to register the edge with the start node
     * @param endNode The end node of the edge
     * @param endNodeRegister The function to call to register the edge with the end node
     * @param track the track to add the edge onto
     * @param id A unique identifier for the edge
     * @param length The length of the edge, in meters
     * @return A new edge
     */
    public TopoEdge makeTopoLink(
            TopoNode startNode,
            Consumer<TopoEdge> startNodeRegister,
            TopoNode endNode,
            Consumer<TopoEdge> endNodeRegister,
            double startNodePosition,
            double endNodePosition,
            Track track,
            String id,
            double length
    ) {
        var edge = TopoEdge.link(startNode, startNodeRegister, endNode, endNodeRegister, startNodePosition,
                endNodePosition, track, id, length);
        this.register(edge);
        return edge;
    }

    /**
     * Creates and registers a new tolopological NoOp (No Operation) node.
     * @param id the unique node identifier
     * @return the newly created node
     */
    public NoOpNode makeNoOpNode(String id) {
        var node = new NoOpNode(id);
        this.register(node);
        return node;
    }

    /** Prevent further modifications. */
    @Override
    public void freeze() {
        for (var e : topoNodes)
            e.freeze();
        for (var e : topoEdges)
            e.freeze();
        for (var e : sectionSignals)
            e.freeze();
        for (var e : blockSections)
            e.freeze();

        topoNodes.freeze();
        topoEdges.freeze();
        sectionSignals.freeze();
        blockSections.freeze();
        lines.freeze();
    }
}
