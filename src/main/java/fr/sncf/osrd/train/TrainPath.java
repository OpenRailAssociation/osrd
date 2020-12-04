package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.pathfinding.CostFunction;
import fr.sncf.osrd.pathfinding.Dijkstra;
import fr.sncf.osrd.timetable.Timetable;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.Freezable;
import fr.sncf.osrd.util.TopoLocation;

import java.util.function.DoubleUnaryOperator;
import java.util.stream.StreamSupport;

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

    public final PathElement get(int index) {
        return edges.get(index);
    }

    final CryoList<PathElement> edges = new CryoList<>();
    final CryoList<TrainStop> stops = new CryoList<>();
    final TopoLocation startingPoint;

    private boolean frozen = false;

    /**
     * Creates a container to hold the path some train will follow
     */
    public TrainPath(TopoLocation startingPoint) {
        this.startingPoint = startingPoint;
    }


    /**
     * Creates and store the path some train will follow
     * @param infra the infra in which the path should be searched
     * @param timetable the timetable containing the list of waypoint
     */
    public TrainPath(Infra infra, Timetable timetable) {
        CostFunction<TopoEdge> costFunc = (edge, begin, end) -> Math.abs(end - begin);
        var start = timetable.entries.first();
        var startPosition = StreamSupport.stream(start.edge.operationalPoints.spliterator(), false)
                .filter(pointValue -> pointValue.value.id == start.operationalPoint.id)
                .findFirst();
        assert startPosition.isPresent();
        var goal = timetable.entries.last();
        var goalPosition = StreamSupport.stream(goal.edge.operationalPoints.spliterator(), false)
                .filter(pointValue -> pointValue.value.id == goal.operationalPoint.id)
                .findFirst();
        assert goalPosition.isPresent();

        Dijkstra.findPath(infra.topoGraph,
                start.edge, startPosition.get().position,
                goal.edge, goalPosition.get().position,
                costFunc,
                this::addEdge);
        startingPoint = new TopoLocation(start.edge, startPosition.get().position);
        freeze();
    }

    /**
     * Add an edge to this TrainPath.
     * @param edge The edge
     * @param direction The direction this path follows this edge with.
     */
    public void addEdge(TopoEdge edge, EdgeDirection direction) {
        double pathLength = 0.0;
        if (!edges.isEmpty()) {
            var lastEdge = edges.last();
            pathLength = lastEdge.pathStartOffset + lastEdge.edge.length;
        }
        edges.add(new PathElement(edge, direction, pathLength));
    }

    @Override
    public void freeze() {
        assert !frozen;
        edges.freeze();
        stops.freeze();
        frozen = true;
    }

    @Override
    public boolean isFrozen() {
        return frozen;
    }
}
