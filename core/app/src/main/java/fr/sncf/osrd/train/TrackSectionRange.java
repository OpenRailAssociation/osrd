package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.DeepComparable;
import fr.sncf.osrd.utils.Range;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.Objects;

public final class TrackSectionRange extends Range implements DeepComparable<TrackSectionRange> {
    public final TrackSection edge;
    public final EdgeDirection direction;

    // region STD_OVERRIDES

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(TrackSectionRange other) {
        return edge == other.edge
                && direction == other.direction
                && begin == other.begin
                && end == other.end;
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

        if (begin != other.begin)
            return false;

        return end == other.end;
    }

    @Override
    public int hashCode() {
        return Objects.hash(edge.id, direction, begin, end);
    }

    // endregion

    /**
     * Creates a new track section range
     * @param edge the edge
     * @param direction the direction to use when iterating on the edge.
     * @param begin the position inside the edge at which the range starts
     * @param end the position inside the edge at which the range ends
     */
    public TrackSectionRange(
            TrackSection edge,
            EdgeDirection direction,
            double begin,
            double end
    ) {
        super(begin, end);
        this.edge = edge;
        this.direction = direction;
    }

    /** Clone a track section range */
    public TrackSectionRange(TrackSectionRange original) {
        super(original.begin, original.end);
        this.edge = original.edge;
        this.direction = original.direction;
    }

    /** Creates the opposite track section range */
    public  TrackSectionRange opposite() {
        return new TrackSectionRange(
                this.edge,
                this.direction.opposite(),
                this.end,
                this.begin
        );
    }

    /** Check if a location is contained in the track section range */
    public boolean containsLocation(TrackSectionLocation location) {
        if (location.edge != edge)
            return false;
        return containsPosition(location.offset);
    }

    public TrackSectionLocation getBeginLocation() {
        return new TrackSectionLocation(edge, begin);
    }

    public TrackSectionLocation getEndLocation() {
        return new TrackSectionLocation(edge, end);
    }


    /** Shrink the range of the track section by following its direction */
    public void shrinkForward(double delta) {
        if (direction == EdgeDirection.START_TO_STOP) {
            begin += delta;
            assert begin <= end;
            return;
        }
        begin -= delta;
        assert begin >= end;
    }

    /** Merge two track sections range that share their edge and direction */
    public static TrackSectionRange merge(TrackSectionRange left, TrackSectionRange right) {
        assert left.edge == right.edge;
        assert left.direction == right.direction;
        if (left.direction == EdgeDirection.START_TO_STOP)
            return new TrackSectionRange(
                    left.edge,
                    left.direction,
                    Double.min(left.begin, right.begin),
                    Double.max(left.end, right.end));
        return new TrackSectionRange(
                left.edge,
                left.direction,
                Double.max(left.begin, right.begin),
                Double.min(left.end, right.end));
    }

    @Override
    public String toString() {
        return String.format("TrackSectionRange { Track=%s, direction=%s, begin=%f, end=%f }",
                edge, direction, begin, end);
    }
}
