package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.PointAttrGetter;
import fr.sncf.osrd.infra.trackgraph.RangeAttrGetter;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.TopoLocation;

import java.util.ArrayDeque;
import java.util.Objects;
import java.util.stream.Stream;

public final class TrainPositionTracker implements Cloneable {
    public final transient Infra infra;

    /** The planned path the train shall follow. */
    public final transient TrainPath path;

    /** The index of the edge the head of the train currently is at. */
    private int currentPathIndex = 0;

    /** The length of the train, in meters. */
    private final double trainLength;

    /** The list of edges the train currently spans over. */
    private final ArrayDeque<PathSection> currentPathEdges;

    /**
     *  The position of the head of the train on its edge.
     *  Its the ground truth for the position of the train.
     */
    private double headEdgePosition;

    /**
     *  The position of the tail on its edge.
     *  Its recomputed from the head edge position at each update.
     */
    private double tailEdgePosition = Double.NaN;

    // region STD_OVERRIDES

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != TrainPositionTracker.class)
            return false;

        var other = (TrainPositionTracker) obj;
        if (!path.equals(other.path))
            return false;

        if (currentPathIndex != other.currentPathIndex)
            return false;

        if (trainLength != other.trainLength)
            return false;

        if (!currentPathEdges.equals(other.currentPathEdges))
            return false;

        if (headEdgePosition != other.headEdgePosition)
            return false;

        return tailEdgePosition == other.tailEdgePosition;
    }

    @Override
    public int hashCode() {
        return Objects.hash(path, currentPathIndex, trainLength, currentPathEdges, headEdgePosition, tailEdgePosition);
    }

    // endregion

    /**
     * Makes a copy of the position tracker.
     * @return a copy of the position tracker.
     */
    @Override
    public TrainPositionTracker clone() {
        return new TrainPositionTracker(this);
    }

    /** Checks whether we reached the end of the path. */
    public boolean hasReachedGoal() {
        // we haven't reached our goal if we aren't on the last edge
        if (currentPathIndex < path.sections.size() - 1)
            return false;

        // if we don't have any and somehow don't have any more
        if (currentPathEdges.isEmpty())
            return true;

        // we must also have reached the correct point on the last edge
        return headEdgePosition >= currentPathEdges.getFirst().endOffset;
    }

    /** Gets the position of the head relative to the start of the path. */
    public double getHeadPathPosition() {
        return currentPathEdges.getFirst().pathStartOffset + headEdgePosition;
    }

    /** Return the head's location on the graph */
    public TopoLocation getHeadTopoLocation() {
        var headPathElement = currentPathEdges.getFirst();
        return new TopoLocation(headPathElement.edge, headEdgePosition);
    }

    /** Gets the position of the head relative to the start of the path. */
    public double getTailPathPosition() {
        return currentPathEdges.getLast().pathStartOffset + tailEdgePosition;
    }

    /**
     * Create a new position tracker on some given infrastructure and path.
     * @param infra the infrastructure to navigate on
     * @param path the path to follow
     * @param trainLength the length of the train
     */
    public TrainPositionTracker(Infra infra, TrainPath path, double trainLength) {
        this.infra = infra;
        this.path = path;
        this.trainLength = trainLength;
        this.currentPathEdges = new ArrayDeque<>();
        var firstSection = path.sections.first();
        currentPathEdges.add(firstSection);
        if (firstSection.direction == EdgeDirection.START_TO_STOP)
            headEdgePosition = firstSection.beginOffset;
        else
            headEdgePosition = firstSection.edge.length - firstSection.beginOffset;
        assert headEdgePosition >= 0.0;
        updatePosition(0);
    }

    private TrainPositionTracker(TrainPositionTracker tracker) {
        this.infra = tracker.infra;
        this.path = tracker.path;
        this.trainLength = tracker.trainLength;
        this.currentPathIndex = tracker.currentPathIndex;
        this.currentPathEdges = tracker.currentPathEdges.clone();
        this.headEdgePosition = tracker.headEdgePosition;
        this.tailEdgePosition = tracker.tailEdgePosition;
    }

    private PathSection headPathEdge() {
        return currentPathEdges.getFirst();
    }

    private PathSection nextPathEdge() {
        ++currentPathIndex;
        return path.sections.get(currentPathIndex);
    }

    private boolean hasNextPathEdge() {
        return currentPathIndex < path.sections.size() - 1;
    }

    /**
     * Updates the position of the train on the network
     * @param positionDelta How much the train moves by
     */
    public void updatePosition(double positionDelta) {
        headEdgePosition += positionDelta;
        assert headEdgePosition >= 0.0;

        // add edges to the current edges queue as the train moves forward
        while (true) {
            var headEdgeLength = headPathEdge().edge.length;
            // if there are no edges after the current head edge, stop
            if (!hasNextPathEdge()) {
                // disallow going out of the path
                if (headEdgePosition > headEdgeLength)
                    headEdgePosition = headEdgeLength;
                break;
            }
            // stop adding edges when the head position lies inside the current head edge
            if (headEdgePosition < headEdgeLength)
                break;

            // add the next edge on the path to the current edges queue
            var newEdge = nextPathEdge();
            assert !currentPathEdges.contains(newEdge);
            currentPathEdges.addFirst(newEdge);

            // TODO: re-introduce events on edge changes?
            // joinedEdgeSignal.dispatch(newEdge);

            // as the head edge changed, so does the position
            headEdgePosition -= headEdgeLength;
            assert headEdgePosition >= 0.0;
        }

        /*
         * remove edges off the tail as the train leaves those
         *
         *   removable           train
         *                   ===========>
         * +------------+-----------+---------+
         *                   ^          ^
         *                  tail        head
         * \__________________________________/
         *          total edges span
         * \____________/\____________________/
         *  tail edge len    next edges span
         *               \______________/\____/
         *          new available space     `head edge headroom
         *
         * continue while newAvailableSpace >= trainLength
         */

        var headEdgeHeadroom = headPathEdge().edge.length - headEdgePosition;
        var totalEdgesSpan = currentPathEdges.stream().mapToDouble(pathEdge -> pathEdge.edge.length).sum();
        assert headEdgeHeadroom >= 0.;
        while (currentPathEdges.size() > 1) {
            var tailEdgeLength = currentPathEdges.getLast().edge.length;
            var nextEdgesSpan = totalEdgesSpan - tailEdgeLength;
            var newAvailableSpace = nextEdgesSpan - headEdgeHeadroom;
            if (newAvailableSpace < trainLength)
                break;

            // TODO: re-introduce events on edge changes?
            // leftEdgeSignal.dispatch(currentPathEdges.removeLast());
            totalEdgesSpan -= tailEdgeLength;
            currentPathEdges.removeLast();
        }
        tailEdgePosition = totalEdgesSpan - (trainLength + headEdgeHeadroom);
    }

    /**
     * Stream point attributes ahead of the train
     * @param distance the lookahead distance
     * @param attrGetter a function that gets a PointSequence from an edge
     * @param <ValueT> the type of the attributes
     * @return a stream on the point attributes ahead of the train
     */
    public <ValueT> Stream<PointValue<ValueT>> streamPointAttrForward(
            double distance,
            PointAttrGetter<ValueT> attrGetter
    ) {
        var headPathPosition = getHeadPathPosition();
        return PathAttrIterator.streamPoints(
                path,
                currentPathIndex,
                headPathPosition,
                headPathPosition + distance,
                attrGetter);
    }

    /**
     * Stream range attributes ahead of the train
     * @param distance the lookahead distance
     * @param attrGetter a function that gets a RangeSequence from an edge
     * @param <ValueT> the type of the attributes
     * @return a stream on the range attributes ahead of the train
     */
    public <ValueT> Stream<RangeValue<ValueT>> streamRangeAttrForward(
            double distance,
            RangeAttrGetter<ValueT> attrGetter
    ) {
        var headPathPosition = getHeadPathPosition();
        return PathAttrIterator.streamRanges(
                path,
                currentPathIndex,
                headPathPosition,
                headPathPosition + distance,
                attrGetter);
    }

    /**
     * Stream point attributes under the train
     * @param attrGetter a function that gets a PointSequence from an edge
     * @param <ValueT> the type of the sequence elements
     * @return a stream on point attributes under the train
     */
    public <ValueT> Stream<PointValue<ValueT>> streamPointAttrUnderTrain(PointAttrGetter<ValueT> attrGetter) {
        var tailPathPosition = getTailPathPosition();
        var firstEdgeIndex = currentPathIndex - currentPathEdges.size();
        return PathAttrIterator.streamPoints(
                path,
                firstEdgeIndex,
                tailPathPosition,
                tailPathPosition + trainLength,
                attrGetter);
    }

    /**
     * Stream range attributes under the train
     * @param attrGetter a function that gets a RangeSequence from an edge
     * @param <ValueT> the type of the sequence elements
     * @return a stream on range attributes under the train
     */
    public <ValueT> Stream<RangeValue<ValueT>> streamRangeAttrUnderTrain(RangeAttrGetter<ValueT> attrGetter) {
        var tailPathPosition = getTailPathPosition();
        var firstEdgeIndex = currentPathIndex - currentPathEdges.size() + 1;
        return PathAttrIterator.streamRanges(
                path,
                firstEdgeIndex,
                tailPathPosition,
                tailPathPosition + trainLength,
                attrGetter);
    }

    /**
     * Computes the maximum grade (slope) under the train.
     * @return the maximum grade (slope) under the train.
     */
    public double maxTrainGrade() {
        return this.streamRangeAttrUnderTrain(TrackSection::getSlope)
                .map(e -> e.value)
                .max(Double::compareTo)
                .orElse(0.);
    }
}
