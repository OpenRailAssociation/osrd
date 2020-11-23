package fr.sncf.osrd.train;

import com.badlogic.ashley.signals.Signal;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.TrackAttrs;
import fr.sncf.osrd.train.TrainPath.PathElement;
import fr.sncf.osrd.util.PointSequence;
import fr.sncf.osrd.util.SortedSequence;
import fr.sncf.osrd.util.ValuedPoint;

import java.util.ArrayDeque;
import java.util.function.Function;
import java.util.stream.Stream;

public class TrainPositionTracker {
    public final Infra infra;

    /** The planned path the train shall follow. */
    public final TrainPath path;

    /** The index of the edge the head of the train currently is at. */
    private int currentPathIndex = 0;

    /** The length of the train, in meters. */
    private final double trainLength;

    /** The list of edges the train currently spans over. */
    private final ArrayDeque<PathElement> currentPathEdges = new ArrayDeque<>();

    /**
     *  The position of the head of the train on its edge.
     *  Its the ground truth for the position of the train.
     */
    private double headEdgePosition = 0.0;

    /**
     *  The position of the tail on its edge.
     *  Its recomputed from the head edge position at each update.
     */
    private double tailEdgePosition = Double.NaN;

    /** Gets the position of the head relative to the start of the path. */
    public double getHeadPathPosition() {
        return currentPathEdges.getFirst().pathStartOffset + headEdgePosition;
    }

    public final Signal<PathElement> joinedEdgeSignal = new Signal<>();
    public final Signal<PathElement> leftEdgeSignal = new Signal<>();

    public TrainPositionTracker(Infra infra, TrainPath path, double trainLength) {
        this.infra = infra;
        this.path = path;
        this.trainLength = trainLength;
    }

    private PathElement headPathEdge() {
        return currentPathEdges.getFirst();
    }

    private PathElement nextPathEdge() {
        ++currentPathIndex;
        return path.edges.get(currentPathIndex);
    }

    private boolean hasNextPathEdge() {
        return currentPathIndex < path.edges.size() - 1;
    }

    /**
     * Updates the position of the train on the network
     * @param speed The current speed of the train, in meters per second
     * @param deltaTime The elapsed time, in seconds
     */
    public void updatePosition(double speed, double deltaTime) {
        headEdgePosition += speed * deltaTime;

        // add edges to the current edges queue as the train moves forward
        while (hasNextPathEdge()) {
            var headEdgeLength = headPathEdge().edge.length;
            // stop adding edges when the head position lies inside the current head edge
            if (headEdgeLength < headEdgePosition)
                break;

            // add the next edge on the path to the current edges queue
            var newEdge = nextPathEdge();
            currentPathEdges.addFirst(newEdge);
            joinedEdgeSignal.dispatch(newEdge);

            // as the head edge changed, so does the position
            headEdgePosition -= headEdgeLength;
        }

        // remove edges off the tail as the train leaves those
        //
        //   removable           train
        //                   ===========>
        // +------------+-----------+---------+
        //                   ^          ^
        //                  tail        head
        // \__________________________________/
        //          total edges span
        // \____________/\____________________/
        //  tail edge len    next edges span
        //               \______________/\____/
        //          new available space     `head edge headroom
        //
        // continue while newAvailableSpace >= trainLength

        var headEdgeHeadroom = headPathEdge().edge.length - headEdgePosition;
        var totalEdgesSpan = currentPathEdges.stream().mapToDouble(pathEdge -> pathEdge.edge.length).sum();
        assert headEdgeHeadroom > 0.;
        while (currentPathEdges.size() > 1) {
            var tailEdgeLength = currentPathEdges.getLast().edge.length;
            var nextEdgesSpan = totalEdgesSpan - tailEdgeLength;
            var newAvailableSpace = nextEdgesSpan - headEdgeHeadroom;
            if (newAvailableSpace < trainLength)
                break;

            leftEdgeSignal.dispatch(currentPathEdges.removeLast());
            totalEdgesSpan -= tailEdgeLength;
        }
        tailEdgePosition = totalEdgesSpan - trainLength;
    }

    public <ValueT> Stream<ValuedPoint<ValueT>> streamAttrForward(
            double distance,
            Function<TrackAttrs.Slice, PointSequence.Slice<ValueT>> attrGetter
    ) {
        var headPathPosition = getHeadPathPosition();
        return PathAttrIterator.streamPoints(
                infra,
                path,
                currentPathIndex,
                headPathPosition,
                headPathPosition + distance,
                attrGetter);
    }
}
