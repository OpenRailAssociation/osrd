package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.utils.graph.Node;

/**
 * A node in the topological infrastructure graph.
 */
public abstract class TrackNode extends Node {
    public final String id;

    public TrackNode(int index, String id) {
        super(index);
        this.id = id;
    }
}
