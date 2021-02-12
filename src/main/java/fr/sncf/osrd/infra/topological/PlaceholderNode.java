package fr.sncf.osrd.infra.topological;

/**
 * A placeholder node type, without any special purpose.
 * Its list of neighbors is held by {@link fr.sncf.osrd.infra.graph.Graph}.
 */
public class PlaceholderNode extends TrackNode {
    public PlaceholderNode(String id) {
        super(id);
    }

    @Override
    public void freeze() {
    }

    @Override
    public boolean isFrozen() {
        return true;
    }
}
