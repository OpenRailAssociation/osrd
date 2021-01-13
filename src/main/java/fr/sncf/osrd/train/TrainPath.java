package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.pathfinding.CostFunction;
import fr.sncf.osrd.pathfinding.Dijkstra;
import fr.sncf.osrd.timetable.TrainSchedule;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.Freezable;

import java.util.Objects;
import java.util.function.DoubleUnaryOperator;

public final class TrainPath implements Freezable {
    public static final class PathElement {
        public final TopoEdge edge;
        public final EdgeDirection direction;
        public final double pathStartOffset;

        @Override
        @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
        public boolean equals(Object obj) {
            if (obj == null)
                return false;

            if (obj.getClass() != PathElement.class)
                return false;

            var other = (PathElement) obj;
            if (!edge.id.equals(other.edge.id))
                return false;

            if (direction != other.direction)
                return false;

            return pathStartOffset == other.pathStartOffset;
        }

        @Override
        public int hashCode() {
            return Objects.hash(edge.id, direction, pathStartOffset);
        }

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

    // the offset in the start
    final double startOffset;
    final double endOffset;

    private boolean frozen = false;

    /**
     * Creates a container to hold the path some train will follow
     */
    public TrainPath(double startOffset, double endOffset) {
        this.startOffset = startOffset;
        this.endOffset = endOffset;
    }


    /**
     * Creates and store the path some train will follow
     * @param infra the infra in which the path should be searched
     * @param timetable the timetable containing the list of waypoint
     */
    public TrainPath(Infra infra, TrainSchedule timetable) {
        // find the start position
        var start = timetable.waypoints.first();
        var startPosition = start.edge.operationalPoints.stream()
                .filter(pointValue -> pointValue.value.id.equals(start.operationalPoint.id))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("couldn't find the starting point operational point"));

        // find the stop position
        var goal = timetable.waypoints.last();
        var goalPosition = goal.edge.operationalPoints.stream()
                .filter(pointValue -> pointValue.value.id.equals(goal.operationalPoint.id))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("couldn't find the goal point operational point"));

        // compute the shortest path from start to stop
        CostFunction<TopoEdge> costFunc = (edge, begin, end) -> Math.abs(end - begin);
        Dijkstra.findPath(infra.topoGraph,
                start.edge, startPosition.position,
                goal.edge, goalPosition.position,
                costFunc,
                this::addEdge);

        this.startOffset = startPosition.position;
        this.endOffset = goalPosition.position;
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
