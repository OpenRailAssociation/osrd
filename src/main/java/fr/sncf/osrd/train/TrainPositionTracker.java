package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayDeque;
import java.util.Objects;

public final class TrainPositionTracker implements Cloneable {
    private final transient Infra infra;
    private final transient Infra.State infraState;

    /** Distance covered since the train has departed */
    private double pathPosition = 0;

    /** The list of edges the train currently spans over. */
    public final ArrayDeque<TrackSectionRange> trackSectionRanges;

    /**
     * Create a new position tracker on some given infrastructure and path.
     * @param infraState the infrastructure to navigate on
     */
    public TrainPositionTracker(
            Infra infra,
            Infra.State infraState,
            ArrayDeque<TrackSectionRange> trackSectionRanges
    ) {
        this.infra = infra;
        this.infraState = infraState;
        this.trackSectionRanges = trackSectionRanges;
    }

    /** Compute initial track section ranges given a location and a train length.
     * @param offset relative to the start of the edge
     */
    public static ArrayDeque<TrackSectionRange> computeInitialPosition(
            Infra infra,
            TrackSection track,
            EdgeDirection direction,
            double offset,
            double trainLength
    ) {
        var positions = new ArrayDeque<TrackSectionRange>();
        offset = track.position(direction, offset);
        while (true) {
            var availableSpace = offset;
            var startOffset = Double.max(0, availableSpace - trainLength);
            positions.add(new TrackSectionRange(track, direction, startOffset, availableSpace));
            if (availableSpace >= trainLength)
                return positions;

            trainLength -= availableSpace;
            var neighbors = infra.trackGraph.getStartNeighborRels(track, direction);
            assert neighbors.size() == 1;
            direction = neighbors.get(0).getDirection(track, direction).opposite();
            track = neighbors.get(0).getEdge(track, direction);
            offset = track.length;
        }
    }

    private TrainPositionTracker(TrainPositionTracker tracker) {
        this.infra = tracker.infra;
        this.infraState = tracker.infraState;
        this.trackSectionRanges = tracker.trackSectionRanges.clone();
        this.pathPosition = tracker.pathPosition;
    }

    // region STD_OVERRIDES

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != TrainPositionTracker.class)
            return false;

        var other = (TrainPositionTracker) obj;
        return trackSectionRanges.equals(other.trackSectionRanges);
    }

    @Override
    public int hashCode() {
        return Objects.hash(trackSectionRanges);
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

    private TrackSectionRange nextTrackSectionPosition(double delta) {
        var curTrackSectionPos = trackSectionRanges.getFirst();
        var neighbors = infra.trackGraph.getEndNeighborRels(curTrackSectionPos.edge, curTrackSectionPos.direction);

        if (neighbors.isEmpty())
            return null;

        var next = neighbors.get(0);
        var nextTrackSection = next.getEdge(curTrackSectionPos.edge, curTrackSectionPos.direction);

        // In case of a switch, we need to get the next track section align with the position of the switch.
        if (neighbors.size() > 1) {
            var nodeIndex = curTrackSectionPos.edge.getEndNode(curTrackSectionPos.direction);
            var node = infra.trackGraph.getNode(nodeIndex);
            assert node.getClass() == Switch.class;
            var switchState = infraState.getSwitchState(((Switch) node).switchIndex);
            nextTrackSection = switchState.getBranch();
        }

        var nextTrackSectionDirection = nextTrackSection.getDirection(
                curTrackSectionPos.edge, curTrackSectionPos.direction);
        return TrackSectionRange.makeNext(nextTrackSection, nextTrackSectionDirection, delta);
    }

    /**
     * Updates the position of the train on the network.
     * @param positionDelta How much the train moves by.
     */
    public void updatePosition(double positionDelta) {
        var delta = updateHeadPosition(positionDelta);
        updateTailPosition(delta);
        pathPosition += delta;
    }

    /** TODO: Check if it's the wanted behavior...
     * Move the head of train to positionDelta ahead.
     * The train stop if it can't go further.
     * @return The delta distance travelled by the train.
     */
    private double updateHeadPosition(double positionDelta) {
        var delta = positionDelta;
        var headPos = trackSectionRanges.getFirst();
        var deltaFree = headPos.edge.length - headPos.endOffset;
        var deltaMove = Double.min(positionDelta, deltaFree);
        headPos.endOffset += deltaMove;
        delta -= deltaMove;

        // add edges to the current edges queue as the train moves forward
        while (positionDelta > 0) {
            var nextPos = nextTrackSectionPosition(positionDelta);
            if (nextPos == null)
                return positionDelta - delta;
            delta -= nextPos.edge.length;
            trackSectionRanges.addFirst(nextPos);
        }
        return positionDelta;
    }

    private void updateTailPosition(double positionDelta) {
        while (true) {
            var tailPos = trackSectionRanges.getLast();
            var availableSpace = tailPos.edge.length - tailPos.beginOffset;
            if (availableSpace > positionDelta) {
                tailPos.beginOffset += positionDelta;
                break;
            }
            positionDelta -= availableSpace;
            trackSectionRanges.removeLast();
        }
    }

    public double getPathPosition() {
        return pathPosition;
    }

    /** Computes the maximum grade (slope) under the train. */
    public double maxTrainGrade() {
        var val = 0.;
        for (var track : trackSectionRanges) {
            for (var slope : TrackSection.getSlope(track.edge, track.direction).data) {
                var pos = track.getEdgeRelPosition(slope.position);
                if (pos > track.beginOffset && pos < track.endOffset)
                    val = Double.max(slope.value, val);
            }
        }
        return val;
    }
}
