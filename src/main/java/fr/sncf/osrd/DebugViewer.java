package fr.sncf.osrd;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.utils.TrackSectionLocation;
import org.graphstream.graph.Edge;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.SingleGraph;
import org.graphstream.ui.geom.Point3;
import org.graphstream.ui.graphicGraph.GraphicGraph;
import org.graphstream.ui.layout.Layouts;
import org.graphstream.ui.spriteManager.Sprite;
import org.graphstream.ui.spriteManager.SpriteManager;
import org.graphstream.ui.swing_viewer.DefaultView;
import org.graphstream.ui.swing_viewer.SwingViewer;
import org.graphstream.ui.swing_viewer.util.DefaultMouseManager;
import org.graphstream.ui.view.View;
import org.graphstream.ui.view.camera.Camera;
import org.graphstream.ui.view.util.InteractiveElement;
import org.graphstream.ui.view.util.MouseManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import javax.swing.event.MouseInputAdapter;
import java.awt.*;
import java.awt.event.MouseEvent;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;

// caused by the temporary opRef.begin == opRef.end
@SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY", "SIC_INNER_SHOULD_BE_STATIC_ANON"})
public class DebugViewer extends ChangeConsumer {
    static final Logger logger = LoggerFactory.getLogger(DebugViewer.class);

    private final Infra infra;
    private final boolean realTime;

    private final SpriteManager spriteManager;
    private final SingleGraph graph;
    private final Map<String, TrainData> trains = new HashMap<>();
    private final Map<Signal, Sprite> signalSprites = new HashMap<>();
    private double currentTime = Double.NaN;

    static final class TrainData {
        final String name;
        final TrainSchedule schedule;
        final Sprite spriteHead;
        final Sprite spriteTail;

        Train.TrainStateChange nextMove = null;

        TrainData(String name, Sprite spriteHead, Sprite spriteTail, TrainSchedule schedule) {
            this.name = name;
            this.schedule = schedule;
            this.spriteHead = spriteHead;
            this.spriteTail = spriteTail;
        }
    }

    private static String encodeSpriteId(String id) {
        // sprite identifiers can't contain dots for some reason
        return id.replace('.', '·');
    }

    private static final String POINT_OP_CSS = "text-alignment: under; shape: box; size: 15px; fill-color: red;";
    private static final String TRAIN_CSS = "text-alignment: under; shape: box; size: 25px, 10px; fill-color: #256ba8;"
            + "z-index: 2; sprite-orientation: to;";

    private DebugViewer(Infra infra, boolean realTime, SingleGraph graph, SpriteManager spriteManager) {
        this.infra = infra;
        this.realTime = realTime;
        this.spriteManager = spriteManager;
        this.graph = graph;
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

        // An edge with a size of graphview size of 1 is a 100m
        var referenceEdgeSize = 100.0;

        for (var node : infra.trackGraph.iterNodes()) {
            Node graphNode = graph.addNode(String.valueOf(node.index));
            //graphNode.setAttribute("ui.label", node.id + "(index = " + node.index + ")");
            graphNode.setAttribute("ui.style", "text-alignment: under;");
            graphNode.setAttribute("layout.weight", referenceEdgeSize);
        }

        for (var edge : infra.trackGraph.iterEdges()) {
            String startId = String.valueOf(edge.startNode);
            String endId = String.valueOf(edge.endNode);
            Edge graphEdge = graph.addEdge(edge.id, startId, endId);
            graphEdge.setAttribute("ui.label", edge.id + "(index = " + edge.index + ")");
            graphEdge.setAttribute("layout.weight", edge.length / referenceEdgeSize);

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

        viewer.show();
        return viewer;
    }

    private void show() {
        // if you believe something is wrong with the code below, just run graph.display() instead

        // create the graphstream swing infrastructure needed
        SwingViewer viewer = new SwingViewer(graph, SwingViewer.ThreadingModel.GRAPH_IN_ANOTHER_THREAD);
        var view = (DefaultView) viewer.addDefaultView(false);
        viewer.enableAutoLayout(Layouts.newLayoutAlgorithm());
        view.setMouseManager(new MouseManager() {
            @Override
            public void init(GraphicGraph graph, View view) {
            }

            @Override
            public void release() {
            }

            @Override
            public EnumSet<InteractiveElement> getManagedTypes() {
                return EnumSet.noneOf(InteractiveElement.class);
            }
        });

        var frame = new JFrame("OSRD");
        frame.setLayout(new BorderLayout());
        frame.setSize(800, 600);
        frame.setLocationRelativeTo(null);
        frame.add(view, BorderLayout.CENTER);
        frame.addWindowListener(view);
        frame.addComponentListener(view);
        view.addMouseWheelListener((mwe) -> {
            var camera = view.getCamera();
            var wheelRotation = mwe.getWheelRotation();
            var zoom = camera.getViewPercent();
            if (wheelRotation > 0) {
                zoom += 0.05;
            } else if (mwe.getWheelRotation() < 0) {
                zoom -= 0.05;
            }
            camera.setViewPercent(Math.max(0, zoom));
        });

        var dragHandler = new MouseInputAdapter() {
            private Point grabPoint = null;
            private Point3 grabPointCenter = null;

            @Override
            public void mouseDragged(MouseEvent e) {
                if (grabPoint == null)
                    return;

                // compute the movement in screen space pixels
                var deltaX = grabPoint.x - e.getX();
                var deltaY = grabPoint.y - e.getY();

                var camera = view.getCamera();
                var ratioPx2Gu = camera.getMetrics().ratioPx2Gu;

                camera.setViewCenter(
                        grabPointCenter.x + deltaX / ratioPx2Gu,
                        grabPointCenter.y - deltaY / ratioPx2Gu,
                        grabPointCenter.z
                );
            }

            @Override
            public void mousePressed(MouseEvent e) {
                grabPoint = new Point(e.getPoint());
                grabPointCenter = new Point3(view.getCamera().getViewCenter());
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                grabPoint = null;
                grabPointCenter = null;
            }
        };

        view.addMouseMotionListener(dragHandler);
        view.addMouseListener(dragHandler);

        frame.setVisible(true);
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
        var spriteHead = spriteManager.addSprite(encodeSpriteId(trainName + "head"));
        spriteHead.setAttribute("ui.style", TRAIN_CSS);
        spriteHead.setAttribute("ui.label", trainName);
        var spriteTail = spriteManager.addSprite(encodeSpriteId(trainName + "tail"));
        spriteTail.setAttribute("ui.style", TRAIN_CSS);
        var trainData = new TrainData(trainName, spriteHead, spriteTail, schedule);
        setTrainLocation(spriteHead, schedule.initialLocation);
        setTrainLocation(spriteTail, schedule.initialLocation);
        trains.put(trainName, trainData);
    }

    private void updateTrain(TrainData trainData) {
        var spriteHead = trainData.spriteHead;
        var nextMove = trainData.nextMove;

        var lastUpdate = nextMove.findLastSpeedUpdate(currentTime);
        var pathHeadPosition = lastUpdate.interpolatePosition(currentTime);
        var pathTailPosition = Double.max(0, pathHeadPosition - trainData.schedule.rollingStock.length);
        var headLocation = trainData.schedule.findLocation(pathHeadPosition);
        var tailLocation = trainData.schedule.findLocation(pathTailPosition);
        var speed = lastUpdate.speed;
        spriteHead.setAttribute("ui.label", String.format("%s (%.2f m/s)", trainData.name, speed));
        setTrainLocation(spriteHead, headLocation);
        setTrainLocation(trainData.spriteTail, tailLocation);
    }

    private void setTrainLocation(Sprite sprite, TrackSectionLocation location) {
        if (!sprite.attached() || !sprite.getAttachment().getId().equals(location.edge.id))
            sprite.attachToEdge(location.edge.id);

        var edgePosition = location.offset / location.edge.length;
        // this assert is very, very important, as a failure results in
        // a very nasty crash inside graphstream
        assert edgePosition >= 0 && edgePosition <= 1 && !Double.isNaN(edgePosition);
        // sprite.setPosition(edgePosition);
        sprite.setPosition(edgePosition);
    }

    private void updateTime(double nextEventTime) throws InterruptedException {
        if (Double.isNaN(currentTime)) {
            currentTime = nextEventTime;
            return;
        }

        // the time to wait between simulation steps
        double interpolationStep = 1.0;

        // if the user doesn't want realtime visualization, update the viewer once per timeline event
        if (!realTime) {
            if (currentTime < nextEventTime) {
                currentTime = nextEventTime;
                for (var trainData : trains.values())
                    updateTrain(trainData);
                Thread.sleep((long) (interpolationStep * 3000));
            }
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
                if (eventValue.getClass() == Train.TrainReachesActionPoint.class) {
                    var trainReachesInteraction = (Train.TrainReachesActionPoint) eventValue;
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
