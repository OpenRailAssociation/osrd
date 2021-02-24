package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.graph.CostFunction;
import fr.sncf.osrd.utils.graph.Dijkstra;
import fr.sncf.osrd.timetable.TrainSchedule;
import fr.sncf.osrd.utils.CryoList;
import fr.sncf.osrd.utils.Freezable;
import fr.sncf.osrd.utils.TopoLocation;

public final class TrainPath implements Freezable {
    public final CryoList<PathSection> sections = new CryoList<>();
    public final CryoList<TrainStop> stops = new CryoList<>();

    private transient boolean frozen = false;

    /**
     * Given a path offset, returns a TopoLocationn
     * @param pathPosition the offset relative to the start of the path
     * @return the location
     */
    public TopoLocation findLocation(double pathPosition) {
        PathSection section = null;
        for (var pathSection : sections) {
            if (pathSection.pathStartOffset > pathPosition)
                break;
            section = pathSection;
        }

        assert section != null;
        double offset = pathPosition - section.pathStartOffset;
        return TopoLocation.fromDirection(section.edge, section.direction, offset);
    }

    /**
     * Creates a container to hold the path some train will follow
     */
    public TrainPath() {
    }


    /**
     * Creates and store the path some train will follow
     * @param infra the infra in which the path should be searched
     * @param timetable the timetable containing the list of waypoint
     */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"}) // TODO: remove me
    public TrainPath(Infra infra, TrainSchedule timetable) {
        // find the start position
        var start = timetable.waypoints.first();
        var startPosition = start.operationalPointRef;

        // find the stop position
        var goal = timetable.waypoints.last();
        var goalPosition = goal.operationalPointRef;

        // compute the shortest path from start to stop
        CostFunction<TrackSection> costFunc = (edge, begin, end) -> Math.abs(end - begin);

        // TODO: more flexible pathfinding
        assert startPosition.begin == startPosition.end;
        assert goalPosition.begin == goalPosition.end;
        Dijkstra.findPath(infra.trackGraph,
                start.edge, startPosition.begin,
                goal.edge, goalPosition.begin,
                costFunc,
                (edge, direction) -> {
                    // find the offset at which the path starts inside the edge
                    double beginOffset = Double.NEGATIVE_INFINITY;
                    if (edge == start.edge)
                        beginOffset = startPosition.begin; // FIXME, this doesn't work if begin != end

                    // find the offset at which the path stops inside the edge
                    double endOffset = Double.POSITIVE_INFINITY;
                    if (edge == goal.edge)
                        endOffset = goalPosition.begin; // FIXME, this doesn't work if begin != end
                    this.addEdge(edge, direction, beginOffset, endOffset);
                });

        freeze();
    }

    /**
     * Add an edge to this TrainPath.
     * @param edge The edge
     * @param direction The direction this path follows this edge with.
     */
    public void addEdge(TrackSection edge, EdgeDirection direction, double beginOffset, double endOffset) {
        double pathLength = 0.0;
        if (!sections.isEmpty()) {
            var lastEdge = sections.last();
            pathLength = lastEdge.pathStartOffset + lastEdge.edge.length;
        }
        sections.add(new PathSection(edge, direction, pathLength, beginOffset, endOffset));
    }

    @Override
    public void freeze() {
        assert !frozen;
        sections.freeze();
        stops.freeze();
        frozen = true;
    }

    @Override
    public boolean isFrozen() {
        return frozen;
    }
}
