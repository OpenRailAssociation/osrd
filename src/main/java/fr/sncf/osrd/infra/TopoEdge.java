package fr.sncf.osrd.infra;

/**
 * An edge in the topological graph.
 */
public class TopoEdge extends AbstractEdge<TopoNode> {
    public final Track track;
    public final String id;
    public final double length;

    /** Create a new topological edge */
    public TopoEdge(Track track, String id, TopoNode startNode, TopoNode endNode, double length) {
        super(startNode, endNode);
        this.track = track;
        this.id = id;
        this.length = length;
    }

    @Override
    public void freeze() {
    }
}
