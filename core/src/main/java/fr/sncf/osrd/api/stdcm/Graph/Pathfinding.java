package fr.sncf.osrd.api.stdcm.Graph;

import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.api.stdcm.Objects.BlockUse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class Pathfinding {
    private static ArrayList<String> index = new ArrayList();
    private static String start = "0-1"; //First edge will always be the same
    private static String end;

    private static class SimpleGraphBuilder {

        private record Edge(double length, String label) {
        }

        private static class Node {
        }

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

        public Pathfinding_algo.EdgeLocation<Edge> getEdgeLocation(String id, double offset) {
            return new Pathfinding_algo.EdgeLocation<>(edges.get(id), offset);
        }

        public Pathfinding_algo.EdgeLocation<Edge> getEdgeLocation(String id) {
            return new Pathfinding_algo.EdgeLocation<>(edges.get(id), 0);
        }
    }

    public static List<SimpleGraphBuilder.Edge> shortest_LMP(ImmutableNetwork<SimpleGraphBuilder.Node, SimpleGraphBuilder.Edge> g, SimpleGraphBuilder builder) {
        return Pathfinding_algo.findEdgePath(
                g,
                List.of(List.of(builder.getEdgeLocation(start)),
                        List.of(
                                builder.getEdgeLocation(end)
                        )
                ),
                edge -> edge.length
        );
    }

    public static ImmutableNetwork<SimpleGraphBuilder.Node, SimpleGraphBuilder.Edge> graph_generation(SimpleGraphBuilder builder) {
        return builder.build();
    }

    public static SimpleGraphBuilder graph_builder(ArrayList<ArrayList<BlockUse>> SOL) {
        var builder = new SimpleGraphBuilder();

        var ID0 = "start";
        int IDpn = 0;
        var IDn = "end";

        var nodes = 3; //first node is the same for all paths thus we will have the same starting edge for all paths
        for (int i = 0; i < SOL.size(); i++) {
            nodes += SOL.get(i).size();
        }

        builder.makeNodes(nodes);

        index.add(ID0);
        index.add(SOL.get(0).get(0).id);

        for (int i = 0; i < SOL.size(); i++) {
            builder.makeEdge(index.indexOf(ID0), index.indexOf(SOL.get(i).get(0).id), 0);
            for (int j = 0; j < SOL.get(i).size() - 1; j++) {
                BlockUse currentB = SOL.get(i).get(j);
                BlockUse nextB = SOL.get(i).get(j + 1);

                var capacity = currentB.length * (currentB.reservationEndTime - currentB.reservationStartTime);

                var ID1 = currentB.id + "/" + i;
                if (j == 0 || j == SOL.get(i).size() - 1)
                    ID1 = currentB.id;

                var ID2 = nextB.id + "/" + i;
                if (j == SOL.get(i).size() - 2)
                    ID2 = nextB.id;

                if (!index.contains(ID1))
                    index.add(ID1);
                if (!index.contains(ID2))
                    index.add(ID2);

                var i1 = index.indexOf(ID1);
                var i2 = index.indexOf(ID2);

                builder.makeEdge(i1, i2, capacity);
                IDpn = i2;
            }

            index.add(IDn);
            builder.makeEdge(IDpn, index.indexOf(IDn), 0);

            if (i == 0) {
                end = (index.size() - 2) + "-" + (index.size() - 1);
            }
        }
        return builder;
    }

    public static ArrayList<String> getIndexTable() {
        return index;
    }
}
