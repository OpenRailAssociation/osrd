package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.utils.graph.AbstractBiGraph;

/**
 * A placeholder node type, without any special purpose.
 * Its list of neighbors is held by {@link AbstractBiGraph}.
 */
public class PlaceholderNode extends TrackNode {
    PlaceholderNode(TrackGraph graph, int index, String id) {
        super(index, id);
        graph.registerNode(this);
    }
}
