package fr.sncf.osrd.infra.viewer;

import com.badlogic.ashley.core.ComponentMapper;
import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.Family;
import com.badlogic.ashley.systems.IteratingSystem;
import fr.sncf.osrd.SystemOrdering;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.train.Train;
import org.graphstream.graph.Edge;
import org.graphstream.graph.Graph;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.SingleGraph;
import org.graphstream.ui.spriteManager.Sprite;
import org.graphstream.ui.spriteManager.SpriteManager;

import java.util.HashMap;
import java.util.Map;

public class InfraViewer extends IteratingSystem {
    private ComponentMapper<Train> trainMapper = ComponentMapper.getFor(Train.class);

    private final Graph graph;
    private final SpriteManager spriteManager;
    private final Map<Train, Sprite> trainSprites = new HashMap<>();

    /**
     * Create a viewer for debug purposes
     * @param infra the infra to display
     */
    public InfraViewer(Infra infra) {
        super(Family.all(Train.class).get(), SystemOrdering.VIEWER.priority);

        System.setProperty("org.graphstream.ui", "swing");
        graph = new SingleGraph("OSRD");
        graph.setAttribute("ui.quality");
        graph.setAttribute("ui.antialias");
        spriteManager = new SpriteManager(graph);

        for (var node : infra.topoGraph.nodes) {
            Node graphNode = graph.addNode(String.valueOf(node.getIndex()));
            graphNode.setAttribute("ui.label", node.id + "(index = " + node.getIndex() + ")");
            graphNode.setAttribute("ui.style", "text-alignment: under;");
        }

        for (var edge : infra.topoGraph.edges) {
            String startId = String.valueOf(edge.startNode);
            String endId = String.valueOf(edge.endNode);
            Edge graphEdge = graph.addEdge(edge.id, startId, endId);
            graphEdge.setAttribute("ui.label", edge.id + "(index = " + edge.getIndex() + ")");

            for (var operationalPoint : edge.operationalPoints) {
                double pos = operationalPoint.position / edge.length;
                var sprite = spriteManager.addSprite(operationalPoint.value.id + "@" + edge.id);
                sprite.attachToEdge(edge.id);
                sprite.setPosition(pos);
                sprite.setAttribute("ui.style", "text-alignment: under; shape: box; size: 15px; fill-color: red;");
                sprite.setAttribute("ui.label", operationalPoint.value.name);
            }
        }
    }

    public void display() {
        graph.display();
    }

    @Override
    protected void processEntity(Entity entity, float deltaTime) {
        Train train = trainMapper.get(entity);
        if (!trainSprites.containsKey(train)) {
            var sprite = spriteManager.addSprite(String.valueOf(trainSprites.size()));
            sprite.setAttribute("ui.style", "text-alignment: under; shape: circle; size: 20px; fill-color: #ffaf01;");
            sprite.setAttribute("ui.label", train.name);
            trainSprites.put(train, sprite);
        }

        var sprite = trainSprites.get(train);
        var headTopoLocation = train.positionTracker.getHeadTopoLocation();

        if (!sprite.attached() || !sprite.getAttachment().getId().equals(headTopoLocation.edge.id))
            sprite.attachToEdge(headTopoLocation.edge.id);

        var edgePosition = headTopoLocation.position / headTopoLocation.edge.length;
        // this assert is very, very important, as a failure results in
        // a very nasty crash inside graphstream
        assert edgePosition >= 0 && edgePosition <= 1 && !Double.isNaN(edgePosition);
        sprite.setPosition(edgePosition);
    }
}
