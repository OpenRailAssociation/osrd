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
        //
        //                edgePathOffset
        //              \ ======>
        //   edge start  +------o---+  edge end
        //                           \
        //                            '-> train path
        //
        //     BACKWARD CASE
        //
        //            <,     edgePathOffset
        //              \       <====
        //   edge start  +------o---+  edge end
        //                           \

        /**
         * Creates a conversion function from path offsets to this edge's offsets.
         * @return the said conversion function
         */
        public DoubleUnaryOperator pathOffsetToEdgeOffset() {
            // position of the train inside the edge, without taking in account the direction
            if (direction == EdgeDirection.START_TO_STOP)
                return (pathOffset) -> {
                    // trackOffset = pathOffset - pathStartOffset
                    return pathOffset - pathStartOffset;
                };

            return (pathOffset) -> {
                // trackOffset = edge.length -pathOffset + pathStartOffset
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
