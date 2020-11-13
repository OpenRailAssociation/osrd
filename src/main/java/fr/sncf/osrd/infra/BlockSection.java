package fr.sncf.osrd.infra;

/**
 * Block sections are an edge between two section signals.
 */
public class BlockSection extends AbstractEdge<SectionSignalNode> {
    public final String id;
    public final double length;

    public BlockSection(String id, SectionSignalNode startNode, SectionSignalNode endNode, double length) {
        super(startNode, endNode);
        this.id = id;
        this.length = length;
    }
}
