package fr.sncf.osrd.infra;

/**
 * Block sections are an edge between two section signals.
 */
public class BlockSection extends AbstractEdge<SectionSignalNode> {
    public final String id;
    public final double length;

    /**
     * The edges the topological section spans over.
     */
    public final StairSequence<TopoEdge> edges;

    public BlockSection(String id, StairSequence<TopoEdge> edges, SectionSignalNode startNode, SectionSignalNode endNode, double length) {
        super(startNode, endNode);
        this.edges = edges;
        this.id = id;
        this.length = length;
    }
}
