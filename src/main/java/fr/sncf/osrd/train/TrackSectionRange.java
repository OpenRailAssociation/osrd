package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.ChangeSerializer.SerializableDouble;
import fr.sncf.osrd.utils.DeepComparable;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.Objects;

public final class TrackSectionRange implements DeepComparable<TrackSectionRange> {
    public final TrackSection edge;
    public final EdgeDirection direction;

    @SerializableDouble
    private double beginPosition;

    @SerializableDouble
    private double endPosition;

    // region STD_OVERRIDES

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(TrackSectionRange other) {
        return edge == other.edge
                && direction == other.direction
                && beginPosition == other.beginPosition
                && endPosition == other.endPosition;
    }

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != TrackSectionRange.class)
            return false;

        var other = (TrackSectionRange) obj;
        if (!edge.id.equals(other.edge.id))
            return false;

        if (direction != other.direction)
            return false;

        if (beginPosition != other.beginPosition)
            return false;

        return endPosition == other.endPosition;
    }

    @Override
    public int hashCode() {
        return Objects.hash(edge.id, direction, beginPosition, endPosition);
    }

    // endregion

    /**
     * Creates a new track section range
     * @param edge the edge
     * @param direction the direction to use when iterating on the edge.
     * @param beginPosition the position inside the edge at which the range starts
     * @param endPosition the position inside the edge at which the range ends
     */
    public TrackSectionRange(
            TrackSection edge,
            EdgeDirection direction,
            double beginPosition,
            double endPosition
    ) {
        this.edge = edge;
        this.direction = direction;
        this.beginPosition = beginPosition;
        this.endPosition = endPosition;
    }

    /** Clone a track section range */
    public TrackSectionRange(TrackSectionRange original) {
        this.edge = original.edge;
        this.direction = original.direction;
        this.beginPosition = original.beginPosition;
        this.endPosition = original.endPosition;
    }

    /** Creates the opposite track section range */
    public  TrackSectionRange opposite() {
        return new TrackSectionRange(
                this.edge,
                this.direction.opposite(),
                this.endPosition,
                this.beginPosition
        );
    }

    /** Build a track section range given a direction and a desired length. */
    public static TrackSectionRange makeNext(
            TrackSection edge,
            EdgeDirection direction,
            double desiredLength
    ) {
        if (direction == EdgeDirection.START_TO_STOP)
            return new TrackSectionRange(edge, direction, 0, Double.min(desiredLength, edge.length));
        return new TrackSectionRange(edge, direction, edge.length, Double.max(edge.length - desiredLength, 0));
    }

    /** Check if a position is contained in the track section range */
    public boolean containsPosition(double position) {
        if (Double.min(beginPosition, endPosition) > position)
            return false;
        return Double.max(beginPosition, endPosition) >= position;
    }

    /** Check if a position is contained in the track section range */
    public boolean containsLocation(TrackSectionLocation location) {
        if (location.edge != edge)
            return false;
        return containsPosition(location.offset);
    }

    public double length() {
        return Math.abs(endPosition - beginPosition);
    }

    /** Get the available forward space of the edge */
    public double forwardSpace() {
        if (direction == EdgeDirection.START_TO_STOP)
            return edge.length - endPosition;
        return endPosition;
    }

    public double getBeginPosition() {
        return beginPosition;
    }

    public double getEndPosition() {
        return endPosition;
    }

    public TrackSectionLocation getBeginLocation() {
        return new TrackSectionLocation(edge, beginPosition);
    }

    public TrackSectionLocation getEndLocation() {
        return new TrackSectionLocation(edge, endPosition);
    }

    /** Expand the range of the track section by following its direction */
    public void expandForward(double delta) {
        if (direction == EdgeDirection.START_TO_STOP) {
            endPosition += delta;
            assert endPosition <= edge.length;
            return;
        }
        endPosition -= delta;
        assert endPosition >= 0.;
    }

    /** Shrink the range of the track section by following its direction */
    public void shrinkForward(double delta) {
        if (direction == EdgeDirection.START_TO_STOP) {
            beginPosition += delta;
            assert beginPosition <= endPosition;
            return;
        }
        beginPosition -= delta;
        assert beginPosition >= endPosition;
    }

    /** Merge two track sections range that share their edge and direction */
    public static TrackSectionRange merge(TrackSectionRange left, TrackSectionRange right) {
        assert left.edge == right.edge;
        assert left.direction == right.direction;
        if (left.direction == EdgeDirection.START_TO_STOP)
            return new TrackSectionRange(
                    left.edge,
                    left.direction,
                    Double.min(left.beginPosition, right.beginPosition),
                    Double.max(left.endPosition, right.endPosition));
        return new TrackSectionRange(
                left.edge,
                left.direction,
                Double.max(left.beginPosition, right.beginPosition),
                Double.min(left.endPosition, right.endPosition));
    }

    /** Returns whether there is a common point between two ranges */
    public boolean intersect(TrackSectionRange other) {
        if (other.edge != edge)
            return false;
        return other.containsPosition(beginPosition) || other.containsPosition(endPosition);
    }
}
