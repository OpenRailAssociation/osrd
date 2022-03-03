package fr.sncf.osrd.utils.graph;

import java.util.ArrayList;
import java.util.List;

public abstract class DirGraph<EdgeT extends Edge> implements IEdgeGraph<EdgeT> {
    private final ArrayList<EdgeT> edges = new ArrayList<>();

    public abstract List<EdgeT> getNeighbors(EdgeT edge);

    @Override
    public EdgeT getEdge(int i) {
        return edges.get(i);
    }

    @Override
    public int getEdgeCount() {
        return edges.size();
    }

    @Override
    public Iterable<EdgeT> iterEdges() {
        return edges;
    }

    @Override
    public void registerEdge(EdgeT edge) {
        if (edge.index == edges.size())
            edges.add(edge);
        else
            edges.set(edge.index, edge);
    }

    @Override
    public int nextEdgeIndex() {
        return edges.size();
    }
}
