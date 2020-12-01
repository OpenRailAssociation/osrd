package fr.sncf.osrd.infra.viewer;

import fr.sncf.osrd.infra.Infra;
import org.graphstream.graph.Edge;
import org.graphstream.graph.Graph;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.SingleGraph;
import org.graphstream.ui.spriteManager.SpriteManager;

public class InfraViewer {
    private final Graph graph;
    private final SpriteManager spriteManager;

    /**
     * Create a viewer for debug purposes
     * @param infra the infra to display
     */
    public InfraViewer(Infra infra) {
        System.setProperty("org.graphstream.ui", "swing");
        graph = new SingleGraph("OSRD");
        graph.setAttribute("ui.quality");
        graph.setAttribute("ui.antialias");
        spriteManager = new SpriteManager(graph);

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

            for (var operationalPoint : edge.operationalPoints) {
                double pos = operationalPoint.position / edge.length;
                System.out.println(pos);
                var sprite = spriteManager.addSprite(operationalPoint.value.id + "@" + edge.id);
                sprite.attachToEdge(edge.id);
                sprite.setPosition(pos);
                sprite.setAttribute("ui.style", "text-alignment: under; shape: circle; size: 15px; fill-color: red;");
                sprite.setAttribute("ui.label", operationalPoint.value.name);
            }
        }
    }

    public void display() {
        graph.display();
    }
}
