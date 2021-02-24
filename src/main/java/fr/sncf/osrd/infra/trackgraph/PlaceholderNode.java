package fr.sncf.osrd.infra.trackgraph;

/**
 * A placeholder node type, without any special purpose.
 * Its list of neighbors is held by {@link fr.sncf.osrd.utils.graph.Graph}.
 */
public class PlaceholderNode extends TrackNode {
    public PlaceholderNode(String id) {
        super(id);
    }
}
