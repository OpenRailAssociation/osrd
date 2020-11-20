package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.util.CryoList;
import java.util.function.DoubleUnaryOperator;

public class TrainPath {
    public class PathElement {
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
        //                      edgePathOffset
        //                    \ ======>
        // track start  -------+------o---+------------> track end
        //              =======>           \
        //            startNodePos          '-> train path
        //
        //     BACKWARD CASE
        //
        //                  <,       edgePathOffset
        //                    \       <====
        // track start  -------+------o---+------------> track end
        //              =======>           \
        //             endNodePos
        public DoubleUnaryOperator pathOffsetToTrackOffset() {
            // position of the train inside the edge, without taking in account the direction
            if (direction == EdgeDirection.START_TO_STOP)
                return (pathOffset) -> {
                    // trackOffset = pathOffset - pathStartOffset + edge.startNodePosition
                    var edgePathOffset = pathOffset - pathStartOffset;
                    return edgePathOffset + edge.startNodeTrackPosition;
                };

            return (pathOffset) -> {
                // trackOffset = edge.endNodePosition -pathOffset + pathStartOffset
                var edgePathOffset = pathOffset - pathStartOffset;
                return edge.endNodeTrackPosition - edgePathOffset;
            };
        }

        public DoubleUnaryOperator trackOffsetToPathOffset() {
            if (direction == EdgeDirection.START_TO_STOP)
                return (trackOffset) -> trackOffset - edge.startNodeTrackPosition + pathStartOffset;
            return (trackOffset) -> edge.endNodeTrackPosition + pathStartOffset - trackOffset;
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
        edges.freeze();
        stops.freeze();
    }
}
