package fr.sncf.osrd.utils.graph;

import java.util.ArrayList;
import java.util.List;

public abstract class BiGraph<EdgeT extends Edge> implements IEdgeGraph<EdgeT> {
    private final ArrayList<EdgeT> edges = new ArrayList<>();

    /**
     * Given a side of the edge, return the list of neighbors
     * @param endpoint the end of the edge to consider
     * @return the list of neighbors at this end
     */
    public abstract List<? extends IBiNeighbor<EdgeT>> getNeighbors(EdgeT edge, EdgeEndpoint endpoint);

    /**
     * The list of reachable edges at the start of the course over the edge.
     * @param dir the course direction
     * @return the list of reachable edges at the start of the course over the edge
     */
    public List<? extends IBiNeighbor<EdgeT>> getStartNeighbors(EdgeT edge, EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return getNeighbors(edge, EdgeEndpoint.BEGIN);
        return getNeighbors(edge, EdgeEndpoint.END);
    }

    /**
     * The list of reachable edges at the end of the course over the edge.
     * @param dir the course direction
     * @return the list of reachable edges at the end of the course over the edge
     */
    public List<? extends IBiNeighbor<EdgeT>> getEndNeighbors(EdgeT edge, EdgeDirection dir) {
        return getStartNeighbors(edge, dir.opposite());
    }

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



