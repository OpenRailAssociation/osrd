package fr.sncf.osrd.infra.blocksection;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.AbstractEdge;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.util.RangeSequence;

/**
 * Block sections are an edge between two section signals.
 */
@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public class BlockSection extends AbstractEdge<SectionSignalNode> {
    public final String id;

    /** The topological edges the block section spans over. */
    public final RangeSequence<TopoEdge> edges;

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
            RangeSequence<TopoEdge> edges,
            SectionSignalNode startNode,
            SectionSignalNode endNode,
            double length
    ) {
        super(startNode.getIndex(), endNode.getIndex(), length);
        this.edges = edges;
        this.id = id;
    }

    @Override
    public void freeze() {
    }
}
