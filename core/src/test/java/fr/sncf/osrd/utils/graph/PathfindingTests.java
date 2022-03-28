package fr.sncf.osrd.utils.graph;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.new_infra_state.implementation.standalone.StandaloneSignalingSimulation;
import fr.sncf.osrd.utils.new_graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class PathfindingTests {

    private static class SimpleGraphBuilder {

        private record Edge(double length, String label){}

        private static class Node{}

        private final ImmutableNetwork.Builder<Node, Edge> builder = NetworkBuilder
                .directed()
                .allowsParallelEdges(true)
                .immutable();
        public final Map<String, Edge> edges = new HashMap<>();
        public final List<Node> nodes = new ArrayList<>();

        public void makeNode() {
            var res = new Node();
            builder.addNode(res);
            nodes.add(res);
        }

        public void makeNodes(int n) {
            for (int i = 0; i < n; i++)
                makeNode();
        }

        public void makeEdge(int n1, int n2, double length) {
            var label = String.format("%d-%s", n1, n2);
            var res = new Edge(length, label);
            builder.addEdge(nodes.get(n1), nodes.get(n2), res);
            edges.put(label, res);
        }

        public ImmutableNetwork<Node, Edge> build() {
            return builder.build();
        }

        public Pathfinding.EdgeLocation<Edge> getEdgeLocation(String id, double offset) {
            return new Pathfinding.EdgeLocation<>(edges.get(id), offset);
        }

        public Pathfinding.EdgeLocation<Edge> getEdgeLocation(String id) {
            return new Pathfinding.EdgeLocation<>(edges.get(id), 0);
        }
    }

    /** A range where the edge is only referenced by its ID (for easier equality check) */
    public record SimpleRange(String id, double begin, double end) {}

    @Test
    public void pathfindingShortestTwoStepsTest() {
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(5);
        builder.makeEdge(0, 1, 0);
        builder.makeEdge(1, 2, 10);
        builder.makeEdge(2, 3, 10);
        builder.makeEdge(1, 3, 21);
        builder.makeEdge(3, 4, 0);
        var g = builder.build();
        var res = Pathfinding.findEdgePath(
                g,
                List.of(builder.getEdgeLocation("0-1")),
                List.of(builder.getEdgeLocation("3-4")),
                edge -> edge.length
        );
        var resIDs = res.stream().map(x -> x.label).toList();
        assertEquals(
                List.of(
                        "0-1",
                        "1-2",
                        "2-3",
                        "3-4"
                ),
                resIDs
        );
    }

    @Test
    public void simplePathfindingTest() {
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(5);
        builder.makeEdge(0, 1, 0);
        builder.makeEdge(1, 2, 10);
        builder.makeEdge(2, 3, 10);
        builder.makeEdge(1, 3, 19);
        builder.makeEdge(3, 4, 0);
        var g = builder.build();
        var res = Pathfinding.findEdgePath(
                g,
                List.of(builder.getEdgeLocation("0-1")),
                List.of(builder.getEdgeLocation("3-4")),
                edge -> edge.length
        );
        var resIDs = res.stream().map(x -> x.label).toList();
        assertEquals(
                List.of(
                        "0-1",
                        "1-3",
                        "3-4"
                ),
                resIDs
        );
    }

    @Test
    public void severalStartsTest() {
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(7);
        builder.makeEdge(0, 1, 0);
        builder.makeEdge(1, 5, 10);

        builder.makeEdge(2, 3, 0);
        builder.makeEdge(3, 4, 5);
        builder.makeEdge(4, 5, 4);

        builder.makeEdge(5, 6, 0);
        var g = builder.build();
        var res = Pathfinding.findEdgePath(
                g,
                List.of(
                        builder.getEdgeLocation("0-1"),
                        builder.getEdgeLocation("2-3")
                ),
                List.of(builder.getEdgeLocation("5-6")),
                edge -> edge.length
        );
        var resIDs = res.stream().map(x -> x.label).toList();
        assertEquals(
                List.of(
                        "2-3",
                        "3-4",
                        "4-5",
                        "5-6"
                ),
                resIDs
        );
    }

    @Test
    public void severalEndsTest() {
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(7);
        builder.makeEdge(0, 1, 0);

        builder.makeEdge(1, 2, 10);
        builder.makeEdge(2, 3, 0);

        builder.makeEdge(1, 4, 4);
        builder.makeEdge(4, 5, 5);
        builder.makeEdge(5, 6, 0);
        var g = builder.build();
        var res = Pathfinding.findEdgePath(
                g,
                List.of(builder.getEdgeLocation("0-1")),
                List.of(
                        builder.getEdgeLocation("2-3"),
                        builder.getEdgeLocation("5-6")
                ),
                edge -> edge.length
        );
        var resIDs = res.stream().map(x -> x.label).toList();
        assertEquals(
                List.of(
                        "0-1",
                        "1-4",
                        "4-5",
                        "5-6"
                ),
                resIDs
        );
    }

    @Test
    public void loopTest() {
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(3);
        builder.makeEdge(0, 1, 1);
        builder.makeEdge(1, 2, 100);
        builder.makeEdge(1, 0, 1);
        var g = builder.build();
        var res = Pathfinding.findEdgePath(
                g,
                List.of(builder.getEdgeLocation("0-1")),
                List.of(builder.getEdgeLocation("1-2")),
                edge -> edge.length
        );
        var resIDs = res.stream().map(x -> x.label).toList();
        assertEquals(
                List.of(
                        "0-1",
                        "1-2"
                ),
                resIDs
        );
    }

    @Test
    public void noPathTest() {
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(4);
        builder.makeEdge(0, 1, 100);
        builder.makeEdge(1, 2, 100);
        builder.makeEdge(2, 3, 100);
        var g = builder.build();
        var res = Pathfinding.findEdgePath(
                g,
                List.of(builder.getEdgeLocation("2-3")),
                List.of(builder.getEdgeLocation("0-1")),
                edge -> edge.length
        );
        assertNull(res);
    }

    @Test
    public void sameEdgeNoPathTest() {
        // The goal is at a smaller offset that the start: no path
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(2);
        builder.makeEdge(0, 1, 100);
        var g = builder.build();
        var res = Pathfinding.findEdgePath(
                g,
                List.of(builder.getEdgeLocation("0-1", 60)),
                List.of(builder.getEdgeLocation("0-1", 30)),
                edge -> edge.length
        );
        assertNull(res);
    }

    @Test
    public void sameEdgeWithLoopTest() {
        // The goal is at a smaller offset that the start: it has to loop through the edges to reach the end
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(3);
        builder.makeEdge(0, 1, 100);
        builder.makeEdge(1, 2, 100);
        builder.makeEdge(2, 0, 100);
        var g = builder.build();
        var res = Pathfinding.findEdgePath(
                g,
                List.of(builder.getEdgeLocation("0-1", 60)),
                List.of(builder.getEdgeLocation("0-1", 30)),
                edge -> edge.length
        );
        var resIDs = res.stream().map(x -> x.label).toList();
        assertEquals(
                List.of(
                        "0-1",
                        "1-2",
                        "2-0",
                        "0-1"
                ),
                resIDs
        );
    }

    @Test
    public void shortestPathWithOffsetsTests() {
        // The start of the end edge is closer on the 0 -> 1 -> 2 -> 3 path,
        // but the 0 -> 1 -> 4 -> 5 path is shortest if we account offsets correctly
        var builder = new SimpleGraphBuilder();
        builder.makeNodes(6);
        builder.makeEdge(0, 1, 0);
        builder.makeEdge(1, 2, 10);
        builder.makeEdge(2, 3, 1000);
        builder.makeEdge(1, 4, 100);
        builder.makeEdge(4, 5, 1000);
        var g = builder.build();
        var res = Pathfinding.findPath(
                g,
                List.of(builder.getEdgeLocation("0-1")),
                List.of(
                        builder.getEdgeLocation("2-3", 500),
                        builder.getEdgeLocation("4-5", 10)
                ),
                edge -> edge.length
        );
        assertEquals(
                List.of(
                        new SimpleRange("0-1", 0, 0),
                        new SimpleRange("1-4", 0, 100),
                        new SimpleRange("4-5", 0, 10)
                ),
                convertRes(res)
        );
    }

    private static List<SimpleRange> convertRes(List<Pathfinding.EdgeRange<SimpleGraphBuilder.Edge>> res) {
        return res.stream()
                .map(x -> new SimpleRange(x.edge().label, x.start(), x.end()))
                .collect(Collectors.toList());
    }
}
