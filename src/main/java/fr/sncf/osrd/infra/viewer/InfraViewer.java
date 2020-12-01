package fr.sncf.osrd.infra.viewer;

import fr.sncf.osrd.infra.Infra;
import org.graphstream.graph.Edge;
import org.graphstream.graph.Graph;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.SingleGraph;

public class InfraViewer {
    private final Graph graph;

    /**
     * Create a viewer for debug purposes
     * @param infra the infra to display
     */
    public InfraViewer(Infra infra) {
        System.setProperty("org.graphstream.ui", "swing");
        graph = new SingleGraph("OSRD");
        graph.setAttribute("ui.quality");
        graph.setAttribute("ui.antialias");

        for (var node : infra.topoGraph.nodes) {
            Node graphNode = graph.addNode(String.valueOf(node.getIndex()));
            graphNode.setAttribute("ui.label", node.id);
            graphNode.setAttribute("ui.style", "text-alignment: under;");
        }

        for (var edge : infra.topoGraph.edges) {
            String startId = String.valueOf(edge.startNode);
            String endId = String.valueOf(edge.endNode);
            Edge graphEdge = graph.addEdge(edge.id, startId, endId);
            graphEdge.setAttribute("ui.label", edge.id);
        }
    }

    public void display() {
        graph.display();
    }
}
