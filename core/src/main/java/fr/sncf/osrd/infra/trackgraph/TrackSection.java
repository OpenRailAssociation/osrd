package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.CatenaryType;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.SpeedSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.utils.*;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.BiNEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import java.util.ArrayList;
import java.util.List;

/**
 * An edge in the topological graph.
 */
public final class TrackSection extends BiNEdge<TrackSection> {
    public final String id;

    public final List<List<Double>> endpointCoords;

    public final ArrayList<TrackSection> startNeighbors = new ArrayList<>();
    public final ArrayList<TrackSection> endNeighbors = new ArrayList<>();

    public static final class RouteFragment extends IntervalNode {
        public final Route route;
        public final double routeOffset;
        public final EdgeDirection direction;

        /** Represent an interval in a route */
        public RouteFragment(
                Route route,
                double routeOffset,
                double trackBegin,
                double trackEnd,
                EdgeDirection direction
        ) {
            super(trackBegin, trackEnd);
            this.route = route;
            this.routeOffset = routeOffset;
            this.direction = direction;
        }
    }

    public final IntervalTree<RouteFragment> forwardRoutes = new IntervalTree<>();
    public final IntervalTree<RouteFragment> backwardRoutes = new IntervalTree<>();

    // the data structure used for the slope automatically negates it when iterated on backwards
    public final DoubleRangeMap forwardGradients = new DoubleRangeMap();
    public final DoubleRangeMap backwardGradients = new DoubleRangeMap();
    public final ArrayList<RangeValue<SpeedSection>> forwardSpeedSections = new ArrayList<>();
    public final ArrayList<RangeValue<SpeedSection>> backwardSpeedSections = new ArrayList<>();
    public final ArrayList<RangeValue<CatenaryType>> forwardCatenarySections = new ArrayList<>();
    public final ArrayList<RangeValue<CatenaryType>> backwardCatenarySections = new ArrayList<>();
    public final PointSequence<OperationalPoint> operationalPoints = new PointSequence<>();
    public final PointSequence<Waypoint> waypoints = new PointSequence<>();
    public final PointSequence<Signal> signals = new PointSequence<>();
    public final PointSequence<ActionPoint> forwardActionPoints = new PointSequence<>();
    public final PointSequence<ActionPoint> backwardActionPoints = new PointSequence<>();

    /** Clamp an offset between 0 and the length of the track section */
    public double clamp(double offset) {
        if (offset < 0)
            return 0;
        return Math.min(offset, length);
    }

    /** Return routes the track section is part of given a direction */
    public IntervalTree<RouteFragment> getRoutes(EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return forwardRoutes;
        return backwardRoutes;
    }

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

    /**
     * Given a direction of the edge, return the list of forward neighbors
     * @param direction the direction of the edge to consider
     * @return the list of neighbors forward
     */
    public List<TrackSection> getForwardNeighbors(EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return endNeighbors;
        return startNeighbors;
    }

    /**
     * Given a direction of the edge, return the list of backward neighbors
     * @param direction the direction of the edge to consider
     * @return the list of neighbors backward
     */
    public List<TrackSection> getBackwardNeighbors(EdgeDirection direction) {
        return getForwardNeighbors(direction.opposite());
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
            double length,
            List<List<Double>> endpointCoords
    ) {
        super(index, startNodeIndex, endNodeIndex, length);
        graph.registerEdge(this);
        this.id = id;
        this.endpointCoords = endpointCoords;
    }

    public static void linkEdges(
            TrackSection edgeA,
            EdgeEndpoint positionOnA,
            TrackSection edgeB,
            EdgeEndpoint positionOnB
    ) {
        linkEdges(edgeA, positionOnA, edgeB, positionOnB, ApplicableDirection.BOTH);
    }

    /** Link two track sections together */
    public static void linkEdges(
            TrackSection edgeA,
            EdgeEndpoint positionOnA,
            TrackSection edgeB,
            EdgeEndpoint positionOnB,
            ApplicableDirection direction
    ) {
        if (direction == ApplicableDirection.BOTH || direction == ApplicableDirection.NORMAL)
            edgeA.getNeighbors(positionOnA).add(edgeB);
        if (direction == ApplicableDirection.BOTH || direction == ApplicableDirection.REVERSE)
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

    /*
     * All the functions below are attributes getters, meant to implement either RangeAttrGetter or PointAttrGetter.
     * These can be passed around to build generic algorithms on attributes.
     */

    /**
     * Gets the speed limit on a given section of track, along a given direction.
     * @param edge the section of track
     * @param direction the direction
     * @return the speed limits
     */
    public static ArrayList<RangeValue<SpeedSection>> getSpeedSections(TrackSection edge, EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return edge.forwardSpeedSections;
        return edge.backwardSpeedSections;
    }

    /**
     * Gets the type of catenary on a given track section, according to a given direction.
     * @param edge the track section
     * @param direction the direction
     * @return type of catenary
     */
    public static ArrayList<RangeValue<CatenaryType>> getCatenarySections(TrackSection edge, EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return edge.forwardCatenarySections;
        return edge.backwardCatenarySections;
    }

    /**
     * Gets visible track objects on a given section of track, along a given direction.
     * @param edge the section of track
     * @param direction the direction
     * @return visible track objects
     */
    public static PointSequence<ActionPoint> getInteractables(TrackSection edge, EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return edge.forwardActionPoints;
        return edge.backwardActionPoints;
    }
}
