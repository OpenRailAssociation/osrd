package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.ChangeSerializer.SerializableDouble;

import java.util.Objects;

public final class TrackSectionRange {
    public final TrackSection edge;
    public final EdgeDirection direction;

    @SerializableDouble
    public double beginOffset;

    @SerializableDouble
    public double endOffset;

    // region STD_OVERRIDES

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

        if (beginOffset != other.beginOffset)
            return false;

        return endOffset == other.endOffset;
    }

    @Override
    public int hashCode() {
        return Objects.hash(edge.id, direction, beginOffset, endOffset);
    }

    // endregion

    /**
     * Creates a new path element
     * @param edge the edge
     * @param direction the direction to use when iterating on the edge
     * @param beginOffset the offset inside the edge at which the path starts
     * @param endOffset the offset inside the edge at which the path ends
     */
    public TrackSectionRange(
            TrackSection edge,
            EdgeDirection direction,
            double beginOffset,
            double endOffset
    ) {
        this.edge = edge;
        this.direction = direction;
        this.beginOffset = beginOffset;
        this.endOffset = endOffset;
    }

    public static TrackSectionRange makeNext(
            TrackSection edge,
            EdgeDirection direction,
            double delta
    ) {
        return new TrackSectionRange(edge, direction, 0, Double.min(delta, edge.length));
    }

    public double getEdgeRelPosition(double position) {
        return edge.position(direction, position);
    }

    public double length() {
        return endOffset - beginOffset;
    }
}
