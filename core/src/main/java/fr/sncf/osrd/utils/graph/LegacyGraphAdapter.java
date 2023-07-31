package fr.sncf.osrd.utils.graph;

import com.google.common.graph.ImmutableNetwork;
import java.util.Collection;

/** Implements our custom Graph interface using an ImmutableNetwork */
public class LegacyGraphAdapter<NodeT, EdgeT> implements Graph<NodeT, EdgeT> {

    private final ImmutableNetwork<NodeT, EdgeT> g;

    public LegacyGraphAdapter(ImmutableNetwork<NodeT, EdgeT> g) {
        this.g = g;
    }

    @Override
    public NodeT getEdgeEnd(EdgeT edge) {
        return g.incidentNodes(edge).nodeV();
    }

    @Override
    public Collection<EdgeT> getAdjacentEdges(NodeT node) {
        return g.outEdges(node);
    }
}
