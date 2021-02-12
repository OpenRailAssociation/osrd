package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.utils.ChangeSerializer.SerializableDouble;

import java.util.Objects;
import java.util.function.DoubleUnaryOperator;

public final class PathSection {
    public final TrackSection edge;
    public final EdgeDirection direction;
    public final double pathStartOffset;

    @SerializableDouble
    public final double beginOffset;

    @SerializableDouble
    public final double endOffset;

    // region STD_OVERRIDES

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != PathSection.class)
            return false;

        var other = (PathSection) obj;
        if (!edge.id.equals(other.edge.id))
            return false;

        if (direction != other.direction)
            return false;

        if (pathStartOffset != other.pathStartOffset)
            return false;

        if (beginOffset != other.beginOffset)
            return false;

        return endOffset == other.endOffset;
    }

    @Override
    public int hashCode() {
        return Objects.hash(edge.id, direction, pathStartOffset, beginOffset, endOffset);
    }

    // endregion

    /**
     * Creates a new path element
     * @param edge the edge
     * @param direction the direction to use when iterating on the edge
     * @param pathStartOffset the offset from the start on the path
     * @param beginOffset the offset inside the edge at which the path starts, or -infinity
     * @param endOffset the offset inside the edge at which the path ends, or +infinity
     */
    public PathSection(
            TrackSection edge,
            EdgeDirection direction,
            double pathStartOffset,
            double beginOffset,
            double endOffset
    ) {
        this.edge = edge;
        this.direction = direction;
        this.pathStartOffset = pathStartOffset;
        this.beginOffset = beginOffset;
        this.endOffset = endOffset;
    }

    public static PathSection makeFirst(
            TrackSection edge,
            EdgeDirection direction,
            double pathStartOffset,
            double endOffset
    ) {
        return new PathSection(edge, direction, pathStartOffset, Double.NEGATIVE_INFINITY, endOffset);
    }

    public static PathSection makeIntermediate(
            TrackSection edge,
            EdgeDirection direction,
            double pathStartOffset
    ) {
        return new PathSection(edge, direction, pathStartOffset, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY);
    }

    /*
     *     FORWARD CASE
     *
     *                edgePathOffset
     *              \ ======>
     *   edge start  +------o---+  edge end
     *                           \
     *                            '-> train path
     *
     *     BACKWARD CASE
     *
     *            <,     edgePathOffset
     *              \       <====
     *   edge start  +------o---+  edge end
     *                           \
     */

    /**
     * Creates a conversion function from path offsets to this edge's offsets.
     * @return the said conversion function
     */
    public DoubleUnaryOperator pathOffsetToEdgeOffset() {
        // position of the train inside the edge, without taking in account the direction
        if (direction == EdgeDirection.START_TO_STOP)
            return (pathOffset) -> {
                // trackOffset = pathOffset - pathStartOffset <= TODO is this dead code ?
                return pathOffset - pathStartOffset;
            };

        return (pathOffset) -> {
            // trackOffset = edge.length -pathOffset + pathStartOffset <= TODO is this dead code ?
            var edgePathOffset = pathOffset - pathStartOffset;
            return edge.length - edgePathOffset;
        };
    }

    /**
     * Creates a conversion function from this edge's offsets to path offsets.
     * @return the said conversion function
     */
    public DoubleUnaryOperator edgeOffsetToPathOffset() {
        if (direction == EdgeDirection.START_TO_STOP)
            return (trackOffset) -> trackOffset + pathStartOffset;
        return (trackOffset) -> edge.length + pathStartOffset - trackOffset;
    }
}
