package fr.sncf.osrd;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.train.Train;
import org.graphstream.graph.Edge;
import org.graphstream.graph.Graph;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.SingleGraph;
import org.graphstream.ui.spriteManager.Sprite;
import org.graphstream.ui.spriteManager.SpriteManager;

import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

// caused by the temporary opRef.begin == opRef.end
@SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
public class DebugViewer {
    private final Graph graph;
    private final SpriteManager spriteManager;
    private final Map<Train, Sprite> trainSprites = new HashMap<>();
    private final Map<Signal, Sprite> signalSprites = new HashMap<>();
    private final Map<String, Aspect> aspects = new HashMap<>();

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
        for (var aspect : infra.aspects.values()) {
            if (aspect.id.toUpperCase(Locale.ROOT).contains("GREEN"))
                aspects.put("GREEN", aspect);
            else if (aspect.id.toUpperCase(Locale.ROOT).contains("YELLOW"))
                aspects.put("YELLOW", aspect);
            else if (aspect.id.toUpperCase(Locale.ROOT).contains("RED"))
                aspects.put("RED", aspect);
        }

        for (var node : infra.trackGraph.iterNodes()) {
            Node graphNode = graph.addNode(String.valueOf(node.index));
            //graphNode.setAttribute("ui.label", node.id + "(index = " + node.index + ")");
            graphNode.setAttribute("ui.style", "text-alignment: under;");
        }

        for (var edge : infra.trackGraph.iterEdges()) {
            String startId = String.valueOf(edge.startNode);
            String endId = String.valueOf(edge.endNode);
            Edge graphEdge = graph.addEdge(edge.id, startId, endId);
            graphEdge.setAttribute("ui.label", edge.id + "(index = " + edge.index + ")");

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

            for (var signal : edge.signals) {
                double pos = signal.position / edge.length;
                var signalRefID = encodeSpriteId(signal.value.id + "@" + edge.id);
                var sprite = spriteManager.addSprite(signalRefID);
                sprite.attachToEdge(edge.id);
                sprite.setPosition(pos);;
                sprite.setAttribute(
                        "ui.style",
                        "text-alignment: under; shape: circle; size: 20px; fill-color: #2a850c;"
                );
                sprite.setAttribute("ui.label", signal.value.id);
                signalSprites.put(signal.value, sprite);
            }
        }
    }

    public void display() {
        graph.display();
    }

    /** Update the debug viewer with the new states of the simulation */
    public void update(Collection<Train> trains, Collection<Signal.State> signals, double currentTime) {
        for (var train : trains)
            displayTrain(train, currentTime);

        for (var signal : signals)
            displaySignal(signal);
    }

    private void displaySignal(Signal.State signal) {
        var sprite = signalSprites.get(signal.signal);
        if (signal.aspects.contains(aspects.get("RED"))) {
            sprite.setAttribute("ui.style", "text-alignment: under; shape: circle; size: 20px; fill-color: #db0c04;");
        } else if (signal.aspects.contains(aspects.get("YELLOW"))) {
            sprite.setAttribute("ui.style", "text-alignment: under; shape: circle; size: 20px; fill-color: #f08a05;");
        } else {
            sprite.setAttribute("ui.style", "text-alignment: under; shape: circle; size: 20px; fill-color: #2a850c;");
        }
    }

    private void displayTrain(Train train, double currentTime) {
        if (!trainSprites.containsKey(train)) {
            var sprite = spriteManager.addSprite(encodeSpriteId(String.valueOf(trainSprites.size())));
            sprite.setAttribute("ui.style", "text-alignment: under; shape: circle; size: 20px; fill-color: #256ba8;");
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
