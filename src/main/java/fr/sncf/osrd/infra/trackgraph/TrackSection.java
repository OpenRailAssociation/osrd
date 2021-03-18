package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.SpeedSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.signaling.TrainInteractable;
import fr.sncf.osrd.utils.graph.BiNEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.utils.*;

import java.util.ArrayList;
import java.util.List;

/**
 * An edge in the topological graph.
 */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class TrackSection extends BiNEdge<TrackSection> {
    public final String id;

    public final ArrayList<TrackSection> startNeighbors = new ArrayList<>();
    public final ArrayList<TrackSection> endNeighbors = new ArrayList<>();
    public final ArrayList<Route> routes = new ArrayList<>();

    // the data structure used for the slope automatically negates it when iterated on backwards
    public final DoubleOrientedRangeSequence slope = new DoubleOrientedRangeSequence();
    public final ArrayList<RangeValue<SpeedSection>> speedSectionsForward = new ArrayList<>();
    public final ArrayList<RangeValue<SpeedSection>> speedSectionsBackward = new ArrayList<>();
    public final IntervalTree<OperationalPoint.Ref> operationalPoints = new IntervalTree<>();
    public final PointSequence<Waypoint> waypoints = new PointSequence<>();
    public final PointSequence<Signal> signals = new PointSequence<>();
    public final PointSequence<TrainInteractable> interactablesForward = new PointSequence<>();
    public final PointSequence<TrainInteractable> interactablesBackward = new PointSequence<>();

    /**
     * Given a side of the edge, return the list of neighbors
     * @param endpoint the end of the edge to consider
     * @return the list of neighbors at this end
     */
    public List<TrackSection> getNeighbors(EdgeEndpoint endpoint) {
        if (endpoint == EdgeEndpoint.BEGIN)
            return startNeighbors;
        return endNeighbors;
    }

    @Override
    public String toString() {
        return String.format("TrackSection { id=%s }", id);
    }

    /**
     * Create a new topological edge.
     * This constructor is private, as the edge should also be registered into the nodes.
     */
    TrackSection(
            TrackGraph graph,
            int index,
            String id,
            int startNodeIndex,
            int endNodeIndex,
            double length
    ) {
        super(index, startNodeIndex, endNodeIndex, length);
        graph.registerEdge(this);
        this.id = id;
    }

    public static void linkEdges(
            TrackSection edgeA,
            EdgeEndpoint positionOnA,
            TrackSection edgeB,
            EdgeEndpoint positionOnB
    ) {
        edgeA.getNeighbors(positionOnA).add(edgeB);
        edgeB.getNeighbors(positionOnB).add(edgeA);
    }


    /**
     * Gets the last valid edge position along a direction
     * @param direction the direction to consider positioning from
     * @return the last valid edge position
     */
    public double lastPosition(EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return length;
        return 0.0;
    }

    /**
     * Gets the first valid edge position along a direction
     * @param direction the direction to consider positioning from
     * @return the first valid edge position
     */
    public double firstPosition(EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return 0.0;
        return length;
    }

    /**
     * Gets the position in the edge along a direction
     * @param direction the direction to consider positioning from
     */
    public double position(EdgeDirection direction, double pos) {
        if (direction == EdgeDirection.START_TO_STOP)
            return pos;
        return length - pos;
    }

    @SuppressFBWarnings({"UPM_UNCALLED_PRIVATE_METHOD"})
    private <ValueT> void validatePoints(PointSequence<ValueT> points) throws InvalidInfraException {
        if (points.getFirstPosition() < 0.)
            throw new InvalidInfraException(String.format("invalid PointSequence start for %s", id));
        if (points.getLastPosition() > length)
            throw new InvalidInfraException(String.format("invalid PointSequence end for %s", id));
    }

    private <ValueT> void validateRanges(RangeSequence<ValueT> ranges) throws InvalidInfraException {
        if (ranges.getFirstPosition() < 0.)
            throw new InvalidInfraException(String.format("invalid RangeSequence start for %s", id));
        if (ranges.getLastPosition() >= length)
            throw new InvalidInfraException(String.format("invalid RangeSequence end for %s", id));
    }

    /**
     * Ensure the edge data in consistent.
     * @throws InvalidInfraException when discrepancies are detected
     */
    public void validate() throws InvalidInfraException {
        validateRanges(slope);
        // TODO: validate speed limits
    }

    /*
     * All the functions below are attributes getters, meant to implement either RangeAttrGetter or PointAttrGetter.
     * These can be passed around to build generic algorithms on attributes.
     */

    public static RangeSequence<Double> getSlope(TrackSection edge, EdgeDirection direction) {
        return edge.slope;
    }

    /**
     * Gets the speed limit on a given section of track, along a given direction.
     * @param edge the section of track
     * @param direction the direction
     * @return the speed limits
     */
    public static ArrayList<RangeValue<SpeedSection>> getSpeedSections(TrackSection edge, EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return edge.speedSectionsForward;
        return edge.speedSectionsBackward;
    }

    /**
     * Gets visible track objects on a given section of track, along a given direction.
     * @param edge the section of track
     * @param direction the direction
     * @return visible track objects
     */
    public static PointSequence<TrainInteractable> getInteractables(TrackSection edge, EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return edge.interactablesForward;
        return edge.interactablesBackward;
    }
}
