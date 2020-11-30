package fr.sncf.osrd.infra.topological;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.blocksection.BlockSection;
import fr.sncf.osrd.infra.graph.AbstractEdge;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.util.PointSequence;
import fr.sncf.osrd.util.RangeSequence;
import fr.sncf.osrd.util.SortedSequence;

/**
 * An edge in the topological graph.
 */
public final class TopoEdge extends AbstractEdge<TopoNode> {
    public final String id;
    public final double length;

    /**
     * Create a new topological edge.
     * This constructor is private, as the edge should also be registered into the nodes.
     */
    private TopoEdge(
            String id,
            int startNodeIndex,
            int endNodeIndex,
            double length
    ) {
        super(startNodeIndex, endNodeIndex);
        this.id = id;
        this.length = length;
    }

    /**
     * Link two nodes with a new edge.
     *
     * @param startNodeIndex The index of the start node of the edge
     * @param endNodeIndex The index of the end node of the edge
     * @param id A unique identifier for the edge
     * @param length The length of the edge, in meters
     * @return A new edge
     */
    public static TopoEdge link(
            int startNodeIndex,
            int endNodeIndex,
            String id,
            double length
    ) {
        return new TopoEdge(id, startNodeIndex, endNodeIndex, length);
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
        validateRanges(blockSections);
        validateRanges(speedLimitsForward);
        validateRanges(speedLimitsBackward);
        validatePoints(operationalPoints);
    }

    @Override
    public void freeze() {
    }

    public final RangeSequence<Double> slope = new RangeSequence<>();
    public final RangeSequence<BlockSection> blockSections = new RangeSequence<>();
    public final RangeSequence<Double> speedLimitsForward = new RangeSequence<>();
    public final RangeSequence<Double> speedLimitsBackward = new RangeSequence<>();
    public final PointSequence<OperationalPoint> operationalPoints = new PointSequence<>();

    /*
     * All the functions below are attributes getters, meant to implement either RangeAttrGetter or PointAttrGetter.
     * These can be passed around to build generic algorithms on attributes.
     */

    public static RangeSequence<Double> getSlope(TopoEdge edge, EdgeDirection direction) {
        return edge.slope;
    }

    public static RangeSequence<BlockSection> getBlockSections(TopoEdge edge, EdgeDirection direction) {
        return edge.blockSections;
    }

    /**
     * Gets the speed limit on a given section of track, along a given direction.
     * @param edge the section of track
     * @param direction the direction
     * @return the speed limits
     */
    public static RangeSequence<Double> getSpeedLimit(TopoEdge edge, EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return edge.speedLimitsForward;
        return edge.speedLimitsBackward;
    }

    public static PointSequence<OperationalPoint> getOperationalPoints(TopoEdge edge, EdgeDirection direction) {
        return edge.operationalPoints;
    }
}
