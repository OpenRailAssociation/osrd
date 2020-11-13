package fr.sncf.osrd.infra;

import java.util.ArrayList;

/**
 * Block sections are an edge between two section signals.
 */
public class BlockSection extends AbstractEdge<SectionSignalNode> {
    public final String id;
    public final double length;

    /**
     * Because of the way switches work, the neighbors relationships aren't stored inside
     * {@link fr.sncf.osrd.infra.SectionSignalNode}, but here. SectionSignalNode looks for
     * the neighbors here. This behavior is better explained in {@link fr.sncf.osrd.infra.Infra}.
     */
    public final ArrayList<BlockSection> startNeighbors = new ArrayList<>();
    public final ArrayList<BlockSection> endNeighbors = new ArrayList<>();

    /** The topological edges the block section spans over. */
    public final StairSequence<TopoEdge> edges;

    /**
     * Creates a new BlockSection edge
     * @param id An unique identifier for the block section
     * @param edges The list of topological edges the block section spans over
     * @param startNode the end signal for the block section
     * @param endNode the start signal for the block section
     * @param length the length of the block section
     */
    public BlockSection(
            String id,
            StairSequence<TopoEdge> edges,
            SectionSignalNode startNode,
            SectionSignalNode endNode,
            double length) {
        super(startNode, endNode);
        this.edges = edges;
        this.id = id;
        this.length = length;
    }
}
