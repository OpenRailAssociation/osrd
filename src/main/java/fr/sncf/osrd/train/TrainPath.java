package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.Freezable;

import java.util.function.DoubleUnaryOperator;

public class TrainPath  implements Freezable {
    public final static class PathElement {
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

        public double getStartTrackOffset() {
            if (direction == EdgeDirection.START_TO_STOP)
                return edge.startNodeTrackPosition;
            return edge.endNodeTrackPosition;
        }

        public double getEndTrackOffset() {
            if (direction == EdgeDirection.START_TO_STOP)
                return edge.endNodeTrackPosition;
            return edge.startNodeTrackPosition;
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
