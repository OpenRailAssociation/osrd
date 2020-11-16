package fr.sncf.osrd.infra;

import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.CryoMap;
import fr.sncf.osrd.util.Freezable;

/**
 * A data structure meant to store the immutable part of a railroad infrastructure.
 *
 * <p>It's meant to be built as follows:</p>
 * <ol>
 *  <li>The topological nodes as registered first</li>
 *  <li>The topological edges are registered with the node, and with the infrastructure</li>
 *  <li>Section signals are registered</li>
 *  <li>block sections are registered</li>
 *  <li>external track attributes are computed</li>
 *  <li>line and tracks are created and registered</li>
 * </ol>
 *
 * <h1>Building a topological graph</h1>
 * <p>A topological graph is a special kind of graph, where there can't be a
 * node that changes the shape of the graph. For example, the following graph:</p>
 *
 * <code>
 *  a       b     c
 *   +------+----+
 *   |           |
 *   +-----------+
 *  d             e
 * </code>
 *
 * <p>Isn't a topological graph, as the shape of the graph wouldn't change if <tt>b</tt>
 * weren't here. The issue can be fixed by removing the excess node, and storing the associated
 * data, such as slope, the position of a section signal, or a speed limit, into an attribute
 * of the new edge.</p>
 *
 * <h1>Block sections</h1>
 * <p>Block sections are sections of track delimited by section signals. Unlike the topology graph,
 * the block section graph is kind of directed: where you can go depends on the edge you're coming
 * from. Consider the following example:</p>
 *
 * <code>
 *             s b
 *            /
 *   a s-----=----s c
 * </code>
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
     * if another line with the same name is already registered.
     */
    public void register(Line line) throws DataIntegrityException {
        var previousValue = lines.putIfAbsent(line.name, line);
        if (previousValue != null)
            throw new DataIntegrityException(String.format("Duplicate line %s", line.name));
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
