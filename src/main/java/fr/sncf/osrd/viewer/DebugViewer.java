package fr.sncf.osrd.viewer;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.simulation.World;
import fr.sncf.osrd.train.Train;
import org.graphstream.graph.Edge;
import org.graphstream.graph.Graph;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.SingleGraph;
import org.graphstream.ui.spriteManager.Sprite;
import org.graphstream.ui.spriteManager.SpriteManager;

import java.util.HashMap;
import java.util.Map;

// caused by the temporary opRef.begin == opRef.end
@SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
public class DebugViewer {
    private final Graph graph;
    private final SpriteManager spriteManager;
    private final Map<Train, Sprite> trainSprites = new HashMap<>();

    private static String encodeSpriteId(String id) {
        // sprite identifiers can't contain dots for some reason
        return id.replace('.', '·');
    }

    private static final String POINT_OP_CSS = "text-alignment: under; shape: box; size: 15px; fill-color: red;";
    private static final String RANGE_OP_CSS = "text-alignment: under; shape: box; size: 15px; fill-color: red;";

    /**
     * Create a viewer for debug purposes
     * @param infra the infrastructure display
     */
    public DebugViewer(Infra infra) {
        System.setProperty("org.graphstream.ui", "swing");
        graph = new SingleGraph("OSRD");
        graph.setAttribute("ui.quality");
        graph.setAttribute("ui.antialias");
        spriteManager = new SpriteManager(graph);

        for (var node : infra.trackGraph.nodes) {
            Node graphNode = graph.addNode(String.valueOf(node.getIndex()));
            graphNode.setAttribute("ui.label", node.id + "(index = " + node.getIndex() + ")");
            graphNode.setAttribute("ui.style", "text-alignment: under;");
        }

        for (var edge : infra.trackGraph.edges) {
            String startId = String.valueOf(edge.startNode);
            String endId = String.valueOf(edge.endNode);
            Edge graphEdge = graph.addEdge(edge.id, startId, endId);
            graphEdge.setAttribute("ui.label", edge.id + "(index = " + edge.getIndex() + ")");

            edge.operationalPoints.getAll((opRef) -> {
                // operational points can be point-like objects, or ranges
                // !! this check causes a linter warning, which has to be waived for the whole class
                if (opRef.begin == opRef.end) {
                    double pos = opRef.begin / edge.length;
                    var opRefID = encodeSpriteId(opRef.op.id + "@" + edge.id);
                    var sprite = spriteManager.addSprite(opRefID);
                    sprite.attachToEdge(edge.id);
                    sprite.setPosition(pos);
                    sprite.setAttribute("ui.style", POINT_OP_CSS);
                    sprite.setAttribute("ui.label", opRef.op.id);
                } else {
                    throw new RuntimeException("");
                }
            });
        }
    }

    public void display() {
        graph.display();
    }

    public void update(World world, double currentTime) {
        for (var train : world.trains)
            displayTrain(train, currentTime);
    }

    private void displayTrain(Train train, double currentTime) {
        if (!trainSprites.containsKey(train)) {
            var sprite = spriteManager.addSprite(encodeSpriteId(String.valueOf(trainSprites.size())));
            sprite.setAttribute("ui.style", "text-alignment: under; shape: circle; size: 20px; fill-color: #ffaf01;");
            sprite.setAttribute("ui.label", train.id);
            trainSprites.put(train, sprite);
        }

        var sprite = trainSprites.get(train);
        var trainPhysics = train.getInterpolatedHeadLocationAndSpeed(currentTime);
        sprite.setAttribute("ui.label", String.format("%s (%.2f m/s)", train.id, trainPhysics.speed));

        var headTopoLocation = trainPhysics.location;
        if (!sprite.attached() || !sprite.getAttachment().getId().equals(headTopoLocation.edge.id))
            sprite.attachToEdge(headTopoLocation.edge.id);

        var edgePosition = headTopoLocation.position / headTopoLocation.edge.length;
        // this assert is very, very important, as a failure results in
        // a very nasty crash inside graphstream
        assert edgePosition >= 0 && edgePosition <= 1 && !Double.isNaN(edgePosition);
        sprite.setPosition(edgePosition);
    }
}
