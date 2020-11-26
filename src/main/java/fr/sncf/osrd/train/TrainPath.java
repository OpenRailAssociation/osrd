package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.Freezable;

import java.util.function.DoubleUnaryOperator;

public class TrainPath  implements Freezable {
    public static final class PathElement {
        public final TopoEdge edge;
        public final EdgeDirection direction;
        public final double pathStartOffset;

        /**
         * Creates a new path element
         * @param edge the edge
         * @param direction the direction to use when iterating on the edge
         * @param pathStartOffset the offset from the start on the path
         */
        public PathElement(TopoEdge edge, EdgeDirection direction, double pathStartOffset) {
            this.edge = edge;
            this.direction = direction;
            this.pathStartOffset = pathStartOffset;
        }

        //     FORWARD CASE
        //                       edgePathOffset
        //                     \ ======>
        // branch start  -------+------o---+------------> branch end
        //               =======>           \
        //             startNodePos          '-> train path
        //
        //     BACKWARD CASE
        //
        //                   <,       edgePathOffset
        //                     \       <====
        // branch start  -------+------o---+------------> branch end
        //               =======>           \
        //              endNodePos

        /**
         * Creates a conversion function from path offsets to this edge's branch offsets.
         * @return the said conversion function
         */
        public DoubleUnaryOperator pathOffsetToBranchOffset() {
            // position of the train inside the edge, without taking in account the direction
            if (direction == EdgeDirection.START_TO_STOP)
                return (pathOffset) -> {
                    // trackOffset = pathOffset - pathStartOffset + edge.startNodePosition
                    var edgePathOffset = pathOffset - pathStartOffset;
                    return edgePathOffset + edge.startBranchPosition;
                };

            return (pathOffset) -> {
                // trackOffset = edge.endNodePosition -pathOffset + pathStartOffset
                var edgePathOffset = pathOffset - pathStartOffset;
                return edge.endBranchPosition - edgePathOffset;
            };
        }

        /**
         * Creates a conversion function from this edge's branch offsets to path offsets.
         * @return the said conversion function
         */
        public DoubleUnaryOperator trackOffsetToPathOffset() {
            if (direction == EdgeDirection.START_TO_STOP)
                return (trackOffset) -> trackOffset - edge.startBranchPosition + pathStartOffset;
            return (trackOffset) -> edge.endBranchPosition + pathStartOffset - trackOffset;
        }

        /**
         * Gets the start branch offset of this edge.
         * The result depends on the direction of the edge.
         * @return this edge's start branch offset
         */
        public double getStartTrackOffset() {
            if (direction == EdgeDirection.START_TO_STOP)
                return edge.startBranchPosition;
            return edge.endBranchPosition;
        }

        /**
         * Gets the end branch offset of this edge.
         * The result depends on the direction of the edge.
         * @return this edge's end branch offset
         */
        public double getEndTrackOffset() {
            if (direction == EdgeDirection.START_TO_STOP)
                return edge.endBranchPosition;
            return edge.startBranchPosition;
        }
    }

    public final PathElement get(int index) {
        return edges.get(index);
    }

    final CryoList<PathElement> edges;
    final CryoList<TrainStop> stops;

    /**
     * Creates a container to hold the path some train will follow
     * @param edges the list of edges the train will travel through
     * @param stops the list of stops
     */
    public TrainPath(CryoList<PathElement> edges, CryoList<TrainStop> stops) {
        this.edges = edges;
        this.stops = stops;
        freeze();
    }

    /**
     * Creates a container to hold the path some train will follow
     */
    public TrainPath() {
        this.edges = new CryoList<>();
        this.stops = new CryoList<>();
    }

    /**
     * Add an edge to this TrainPath.
     * @param edge The edge
     * @param direction The direction this path follows this edge with.
     */
    public void addEdge(TopoEdge edge, EdgeDirection direction) {
        double pathLength = 0.0;
        if (!edges.isEmpty()) {
            var lastEdge = edges.get(edges.size() - 1);
            pathLength = lastEdge.pathStartOffset + lastEdge.edge.length;
        }
        edges.add(new PathElement(edge, direction, pathLength));
    }

    @Override
    public void freeze() {
        edges.freeze();
        stops.freeze();
    }
}
