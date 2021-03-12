package fr.sncf.osrd;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.timetable.TrainSchedule;
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
public class DebugViewer extends ChangeConsumer {
    private final Infra infra;
    private final boolean realTime;

    private final Graph graph;
    private final SpriteManager spriteManager;
    private final Map<String, TrainData> trains = new HashMap<>();
    private final Map<Signal, Sprite> signalSprites = new HashMap<>();

    static final class TrainData {
        final String name;
        final TrainSchedule schedule;
        final Sprite sprite;

        Train.TrainStateChange nextMove = null;

        TrainData(String name, Sprite sprite, TrainSchedule schedule) {
            this.name = name;
            this.schedule = schedule;
            this.sprite = sprite;
        }
    }

    private static String encodeSpriteId(String id) {
        // sprite identifiers can't contain dots for some reason
        return id.replace('.', '·');
    }

    private static final String POINT_OP_CSS = "text-alignment: under; shape: box; size: 15px; fill-color: red;";

    private DebugViewer(Infra infra, boolean realTime, Graph graph, SpriteManager spriteManager) {
        this.infra = infra;
        this.realTime = realTime;
        this.graph = graph;
        this.spriteManager = spriteManager;
    }

    /**
     * Create a viewer for debug purposes
     * @param infra the infrastructure display
     */
    public static DebugViewer from(Infra infra, boolean realTime) {
        System.setProperty("org.graphstream.ui", "swing");

        var graph = new SingleGraph("OSRD");
        graph.setAttribute("ui.quality");
        graph.setAttribute("ui.antialias");
        var spriteManager = new SpriteManager(graph);
        var viewer = new DebugViewer(infra, realTime, graph, spriteManager);

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
                sprite.setAttribute("ui.label", signal.value.id);
                viewer.signalSprites.put(signal.value, sprite);
                viewer.updateSignal(signal.value, signal.value.getInitialAspects());
            }
        }

        graph.display();
        return viewer;
    }

    private void updateSignal(Signal signal, RSAspectSet aspects) {
        var sprite = signalSprites.get(signal);

        var signalCSS = String.format(
                "text-alignment: under; shape: circle; size: 20px; fill-color: %s;",
                aspects.iterator().next().color
        );

        sprite.setAttribute("ui.style", signalCSS);
    }

    private void createTrain(TrainSchedule schedule) {
        var trainName = schedule.trainID.trainName;
        var sprite = spriteManager.addSprite(encodeSpriteId(String.valueOf(trains.size())));
        sprite.setAttribute("ui.style", "text-alignment: under; shape: circle; size: 20px; fill-color: #256ba8;");
        sprite.setAttribute("ui.label", trainName);
        trains.put(trainName, new TrainData(trainName, sprite, schedule));
    }

    private void updateTrain(TrainData trainData) {
        var sprite = trainData.sprite;
        var nextMove = trainData.nextMove;

        var lastUpdate = nextMove.findLastSpeedUpdate(currentTime);
        var pathPosition = lastUpdate.interpolatePosition(currentTime);
        var headTopoLocation = trainData.schedule.findLocation(pathPosition);
        var speed = lastUpdate.speed;

        sprite.setAttribute("ui.label", String.format("%s (%.2f m/s)", trainData.name, speed));

        if (!sprite.attached() || !sprite.getAttachment().getId().equals(headTopoLocation.edge.id))
            sprite.attachToEdge(headTopoLocation.edge.id);

        var edgePosition = headTopoLocation.position / headTopoLocation.edge.length;
        // this assert is very, very important, as a failure results in
        // a very nasty crash inside graphstream
        assert edgePosition >= 0 && edgePosition <= 1 && !Double.isNaN(edgePosition);
        sprite.setPosition(edgePosition);
    }

    private double currentTime = Double.NaN;

    private void updateTime(double nextEventTime) throws InterruptedException {
        if (Double.isNaN(currentTime)) {
            currentTime = nextEventTime;
            return;
        }

        // the time to wait between simulation steps
        double interpolationStep = 1.0;

        // if the user doesn't want realtime visualization, update the viewer once per timeline event
        if (!realTime) {
            Thread.sleep((long) (interpolationStep * 1000));
            return;
        }

        // move the time forward by time increments
        // to help the viewer see something
        while (currentTime < nextEventTime) {
            currentTime += interpolationStep;
            if (currentTime > nextEventTime)
                currentTime = nextEventTime;

            Thread.sleep((long) (interpolationStep * 1000));
            for (var trainData : trains.values())
                updateTrain(trainData);
        }
    }

    @Override
    public void changeCreationCallback(Change change) {
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public void changePublishedCallback(Change change) {
        // region TRAIN_CHANGES
        if (change.getClass() == Train.TrainCreatedChange.class) {
            var trainCreated = (Train.TrainCreatedChange) change;
            createTrain(trainCreated.schedule);
            return;
        }

        if (change.getClass() == Simulation.TimelineEventCreated.class) {
            var timelineEventCreated = (Simulation.TimelineEventCreated<?, ?>) change;
            if (timelineEventCreated.entityId.getClass() == TrainSchedule.TrainID.class) {
                var trainName = ((TrainSchedule.TrainID) timelineEventCreated.entityId).trainName;
                var eventValue = timelineEventCreated.getValue();
                if (eventValue.getClass() == Train.TrainReachesInteraction.class) {
                    var trainReachesInteraction = (Train.TrainReachesInteraction) eventValue;
                    trains.get(trainName).nextMove = trainReachesInteraction.trainStateChange;
                }
            }
        }

        // endregion

        // region SIGNAL_CHANGES
        if (change.getClass() == Signal.SignalAspectChange.class) {
            var aspectChange = (Signal.SignalAspectChange) change;
            var signal = infra.signals.get(aspectChange.entityId.signalIndex);
            updateSignal(signal, aspectChange.aspects);
            return;
        }
        // endregion

        if (change.getClass() == Simulation.TimelineEventOccurred.class) {
            var eventOccuredChange = (Simulation.TimelineEventOccurred) change;
            try {
                updateTime(eventOccuredChange.timelineEventId.scheduledTime);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }
    }
}
