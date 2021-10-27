package fr.sncf.osrd.train;

import static java.lang.Math.abs;
import static java.lang.Math.min;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.utils.DeepComparable;
import fr.sncf.osrd.utils.DeepEqualsUtils;
import fr.sncf.osrd.utils.Range;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.*;
import java.util.stream.Collectors;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class TrainPositionTracker implements Cloneable, DeepComparable<TrainPositionTracker> {
    private final transient Infra infra;
    private final transient InfraState infraState;

    /** Distance covered since the train has departed */
    private double pathPosition = 0;

    /** The list of edges the train currently spans over.
     * First = head of the train, last = tail */
    public final ArrayDeque<TrackSectionRange> trackSectionRanges;

    /** The path of the train */
    public final List<TrackSectionRange> trackSectionPath;

    /** If set to true, we follow the given path rather than the switch positions. Used for margin computations */
    public boolean ignoreInfraState = false;

    /** Used for assertions only */
    private final Set<String> trackSectionsOnPath;

    /**
     * Create a new position tracker on some given infrastructure and path.
     * @param infraState the infrastructure to navigate on
     */
    public TrainPositionTracker(
            Infra infra,
            InfraState infraState,
            ArrayDeque<TrackSectionRange> trackSectionRanges,
            List<TrackSectionRange> trackSectionPath
    ) {
        this.infra = infra;
        this.infraState = infraState;
        this.trackSectionRanges = trackSectionRanges;
        this.trackSectionPath = trackSectionPath;
        trackSectionsOnPath = trackSectionPath.stream()
                .map(range -> range.edge.id)
                .collect(Collectors.toSet());
    }

    private ArrayDeque<TrackSectionRange> cloneTrackSectionRanges(ArrayDeque<TrackSectionRange> other) {
        var res = new ArrayDeque<TrackSectionRange>();
        for (var range : other)
            res.add(new TrackSectionRange(range));
        return res;
    }

    private TrainPositionTracker(TrainPositionTracker tracker) {
        this.infra = tracker.infra;
        this.infraState = tracker.infraState;
        this.trackSectionRanges = cloneTrackSectionRanges(tracker.trackSectionRanges);
        this.pathPosition = tracker.pathPosition;
        this.trackSectionPath = new ArrayList<>(tracker.trackSectionPath);
        this.ignoreInfraState = tracker.ignoreInfraState;
        this.trackSectionsOnPath = tracker.trackSectionsOnPath;
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
        var neighbors = infra.trackGraph.getEndNeighborRels(
                curTrackSectionPos.edge,
                curTrackSectionPos.direction
        );

        if (neighbors.isEmpty())
            throw new RuntimeException("Couldn't find a next track section");

        var next = neighbors.get(0);
        var nextTrackSection = next.getEdge(curTrackSectionPos.edge, curTrackSectionPos.direction);

        // In case of a switch, we need to get the next track section align with the position of the switch.
        if (neighbors.size() > 1) {
            if (ignoreInfraState) {
                // If we need to ignore the infra state, we refer to the given path instead
                nextTrackSection = null;
                var currentEdge = curTrackSectionPos.edge;
                for (int i = 1; i < trackSectionPath.size(); i++) {
                    var prevRange = trackSectionPath.get(i - 1);
                    if (prevRange.edge.id.equals(currentEdge.id)
                            && prevRange.direction.equals(curTrackSectionPos.direction)) {
                        nextTrackSection = trackSectionPath.get(i).edge;
                        break;
                    }
                }
                if (nextTrackSection == null)
                    throw new RuntimeException("Can't move train further because it has reached the end of its path");
            } else {
                var nodeIndex = curTrackSectionPos.edge.getEndNode(curTrackSectionPos.direction);
                var node = infra.trackGraph.getNode(nodeIndex);
                assert node.getClass() == Switch.class;
                var switchState = infraState.getSwitchState(((Switch) node).switchIndex);
                nextTrackSection = switchState.getBranch(curTrackSectionPos.edge, curTrackSectionPos.direction);
                if (nextTrackSection == null)
                    throw new RuntimeException("Can't move the train further because a switch is in motion.");
                assert trackSectionsOnPath.contains(nextTrackSection.id);
            }
        }

        var nextTrackSectionDirection = nextTrackSection.getDirection(
                curTrackSectionPos.edge, curTrackSectionPos.direction);
        return TrackSectionRange.makeNext(nextTrackSection, nextTrackSectionDirection, delta);
    }

    private TrackSectionRange previousTrackSectionPosition(double delta) {
        var curTrackSectionPos = trackSectionRanges.getLast();
        var neighbors = infra.trackGraph.getStartNeighborRels(
                curTrackSectionPos.edge,
                curTrackSectionPos.direction
        );

        if (neighbors.isEmpty())
            return null;

        var prev = neighbors.get(neighbors.size() - 1);
        var prevTrackSection = prev.getEdge(curTrackSectionPos.edge, curTrackSectionPos.direction);

        // In case of a switch, we need to get the next track section align with the position of the switch.
        if (neighbors.size() > 1) {
            assert ignoreInfraState;
            // If we need to ignore the infra state, we refer to the given path instead
            prevTrackSection = null;
            var currentEdge = curTrackSectionPos.edge;
            for (int i = 1; i < trackSectionPath.size(); i++) {
                if (trackSectionPath.get(i).edge.id.equals(currentEdge.id)) {
                    prevTrackSection = trackSectionPath.get(i - 1).edge;
                    break;
                }
            }
            if (prevTrackSection == null)
                throw new RuntimeException("Can't move train further because it has reached the end of its path");
        }

        var prevTrackSectionDirection = prevTrackSection.getDirection(
                curTrackSectionPos.edge, curTrackSectionPos.direction.opposite()).opposite();
        return TrackSectionRange.makePrev(prevTrackSection, prevTrackSectionDirection, delta);
    }

    /**
     * Updates the position of the train on the network.
     * @param positionDelta How much the train moves by.
     */
    public void updatePosition(double expectedTrainLength, double positionDelta) {
        if (positionDelta >= 0)
            updateHeadPosition(positionDelta);
        else
            updateHeadPositionBackwards(positionDelta);
        pathPosition += positionDelta;

        double currentTrainLength = trackSectionRanges.stream().mapToDouble(Range::length).sum();

        expectedTrainLength = min(expectedTrainLength, pathPosition);

        var tailDisplacement = currentTrainLength - expectedTrainLength;
        if (tailDisplacement > 0 && positionDelta > 0)
            updateTailPosition(tailDisplacement);
        else if (tailDisplacement < 0 && positionDelta < 0)
            updateTailPositionBackwards(tailDisplacement);

        assertIntegrity();
        var actualTrainLength = trackSectionRanges.stream().mapToDouble(Range::length).sum();
        assert abs(actualTrainLength - expectedTrainLength) < 1e-3;
    }

    /** TODO: Check if it's the wanted behavior...
     * Move the head of train to positionDelta ahead.
     * The train stop if it can't go further.
     */
    private void updateHeadPosition(double targetDist) {
        var remainingDist = targetDist;
        var headPos = trackSectionRanges.getFirst();
        var edgeSpaceAhead = headPos.forwardSpace();
        var edgeMovement = Double.min(targetDist, edgeSpaceAhead);
        headPos.expandForward(edgeMovement);
        remainingDist -= edgeMovement;

        // add edges to the current edges queue as the train moves forward
        while (remainingDist > 0) {
            var nextPos = nextTrackSectionPosition(remainingDist);
            // this should kind of be nextPos.length(), but doing it this way avoids float compare errors
            remainingDist -= nextPos.edge.length;
            trackSectionRanges.addFirst(nextPos);
        }
    }

    /**
     * Move the head of train to positionDelta backwards.
     * The train stop if it can't go further.
     */
    private void updateHeadPositionBackwards(double targetDist) {
        var remainingDist = abs(targetDist);
        var headPos = trackSectionRanges.getFirst();
        var availableSpace = headPos.length();
        var edgeMovement = Double.min(abs(targetDist), availableSpace);
        headPos.expandBackwards(edgeMovement);
        remainingDist -= edgeMovement;

        // remove edges to the current edges queue as the train moves backwards
        if (remainingDist > 0) {
            trackSectionRanges.removeFirst();
            updateHeadPositionBackwards(remainingDist);
        }
    }

    private void updateTailPosition(double positionDelta) {
        while (true) {
            var tailPos = trackSectionRanges.getLast();
            var availableSpace = tailPos.length();
            if (availableSpace > positionDelta) {
                tailPos.shrinkForward(positionDelta);
                break;
            }
            positionDelta -= availableSpace;
            trackSectionRanges.removeLast();
        }
    }

    private void updateTailPositionBackwards(double positionDelta) {
        var remainingDist = abs(positionDelta);
        var tailPos = trackSectionRanges.getLast();
        var edgeSpaceBehind = abs(tailPos.backwardsSpace());
        var edgeMovement = Double.min(abs(positionDelta), edgeSpaceBehind);
        tailPos.shrinkBackwards(edgeMovement);
        remainingDist -= edgeMovement;

        // add edges to the current edges queue as the train moves backwards
        while (remainingDist > TrainPhysicsIntegrator.limitPositionDelta) {
            var previousPos = previousTrackSectionPosition(remainingDist);
            if (previousPos == null)
                break;
            // this should kind of be previousPos.length(), but doing it this way avoids float compare errors
            remainingDist -= previousPos.length();
            trackSectionRanges.addLast(previousPos);
        }
    }

    public double getPathPosition() {
        return pathPosition;
    }

    /** Computes the average grade (slope) under the train. */
    public double meanTrainGrade() {
        double meanVal = 0.;
        double totalLength = 0.;
        for (var track : trackSectionRanges) {
            var gradients = track.edge.forwardGradients;
            if (track.direction == EdgeDirection.STOP_TO_START)
                gradients = track.edge.backwardGradients;

            var slopesUnderTheTrain = gradients.getValuesInRange(track.getBeginPosition(), track.getEndPosition());

            for (var slope : slopesUnderTheTrain.entrySet()) {
                var length = slope.getKey().length();
                meanVal += slope.getValue() * length;
                totalLength += length;
            }

        }
        return totalLength > 0. ? meanVal / totalLength : 0.;
    }

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(TrainPositionTracker other) {
        return pathPosition == other.pathPosition
                && DeepEqualsUtils.deepEquals(trackSectionRanges, other.trackSectionRanges);
    }

    /** Runs some assertions on the integrity of the position tracker */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"}) // we do want exact equalities here
    public void assertIntegrity() {
        // Checks that the location / position remain coherent
        var trackLocation = trackSectionRanges.getFirst().getEndLocation();
        var diff = abs(pathPosition - TrainPath.convertTrackLocation(trackLocation, trackSectionPath));
        assert diff < 1e-3;

        // Asserts that we reach the end of each track section that isn't the last one
        var itForward = trackSectionRanges.iterator();
        while (itForward.hasNext()) {
            var range = itForward.next();
            if (itForward.hasNext()) {
                if (range.direction == EdgeDirection.START_TO_STOP)
                    assert range.getBeginPosition() == 0;
                else
                    assert range.getBeginPosition() == range.edge.length;
            }
        }

        // Asserts that we reach the beginning of each track section that isn't the first one
        var itBackward = trackSectionRanges.descendingIterator();
        while (itBackward.hasNext()) {
            var range = itBackward.next();
            if (itBackward.hasNext()) {
                if (range.direction == EdgeDirection.START_TO_STOP)
                    assert range.getEndPosition() == range.edge.length;
                else
                    assert range.getEndPosition() == 0;
            }
        }
    }

    @Override
    public String toString() {
        return String.format("TrainPositionTracker { position=%s }", pathPosition);
    }
}
