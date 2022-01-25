package fr.sncf.osrd.utils.graph;

import java.util.*;

/** Computes the shortest paths between each pair of nodes
 *
 * Note: pathfinding is made using edges and `graph.getNeighbors`, to work with the route graph, ids are edge id */
public class FloydWarshall<EdgeT extends DirNEdge, NodeT extends Node>  {

    private final List<List<Double>> distances;
    private final List<List<Integer>> next;
    private final DirNGraph<EdgeT, NodeT> graph;

    private FloydWarshall(DirNGraph<EdgeT, NodeT> graph, List<List<Double>> distances, List<List<Integer>> next) {
        this.distances = distances;
        this.next = next;
        this.graph = graph;
        assert next.size() == distances.size();
    }


    /** Creates a FloydWarshall object from a graph */
    public static <EdgeT extends DirNEdge, NodeT extends Node>
    FloydWarshall<EdgeT, NodeT> from(DirNGraph<EdgeT, NodeT> graph) {
        // Init arrays
        var size = graph.getEdgeCount();
        var distances = new ArrayList<List<Double>>(size);
        for (int i = 0; i < size; i++) {
            distances.add(new ArrayList<>());
            for (int j = 0; j < size; j++)
                distances.get(i).add(Double.POSITIVE_INFINITY);
        }
        var next = new ArrayList<List<Integer>>(size);
        for (int i = 0; i < size; i++) {
            next.add(new ArrayList<>());
            for (int j = 0; j < size; j++)
                next.get(i).add(null);
        }
        for (int i = 0; i < size; i++) {
            distances.get(i).set(i, 0.);
            next.get(i).set(i, i);
        }
        for (int i = 0; i < graph.getEdgeCount(); i++) {
            var edge = graph.getEdge(i);
            for (var neighbor : graph.getNeighbors(edge)) {
                distances.get(edge.index).set(neighbor.index, edge.length);
                next.get(edge.index).set(neighbor.index, neighbor.index);
            }
        }

        // Compute distances
        for (int k = 0; k < distances.size(); k++)
            for (int i = 0; i < distances.size(); i++)
                for (int j = 0; j < distances.size(); j++) {
                    var newDist = distances.get(i).get(k) + distances.get(k).get(j);
                    if (distances.get(i).get(j) > newDist) {
                        distances.get(i).set(j, newDist);
                        next.get(i).set(j, next.get(i).get(k));
                    }
                }

        return new FloydWarshall<>(graph, distances, next);
    }

    /** Returns the distance between the two edges */
    public double distance(int from, int to) {
        return distances.get(from).get(to);
    }

    /** Returns a list of edge to link the two edges */
    public List<EdgeT> getPath(int from, int to) {
        if (next.get(from).get(to) == null)
            return Collections.emptyList();
        var res = new ArrayList<EdgeT>();
        res.add(graph.getEdge(from));
        var node = from;
        while (node != to){
            node = next.get(node).get(to);
            res.add(graph.getEdge(node));
        }
        return res;
    }

    /** Returns the longest path in the graph */
    public List<EdgeT> getLongestPath() {
        assert distances.size() > 0;
        var maxDistance = 0.;
        var from = 0;
        var to = 0;
        for (int i = 0; i < distances.size(); i++)
            for (int j = 0; j < distances.size(); j++) {
                var d = distances.get(i).get(j);
                if (d > maxDistance && Double.isFinite(d)) {
                    maxDistance = d;
                    from = i;
                    to = j;
                }
            }
        return getPath(from, to);
    }
}
