package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.timetable.TrainScheduleWaypoint;
import fr.sncf.osrd.utils.graph.*;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.timetable.TrainSchedule;
import fr.sncf.osrd.utils.CryoList;
import fr.sncf.osrd.utils.Freezable;
import fr.sncf.osrd.utils.TopoLocation;
import fr.sncf.osrd.utils.graph.path.BasicPathStart;
import fr.sncf.osrd.utils.graph.path.FullPathArray;

import java.util.ArrayList;

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

    /** Creates a container to hold the path some train will follow */
    public TrainPath() {
    }


    /** Creates and store the path some train will follow */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"}) // TODO: remove me
    public static TrainPath from(Infra infra, CryoList<TrainScheduleWaypoint> waypoints) {
        // find the start position
        var start = waypoints.first();
        var startPosition = start.operationalPointRef;

        // find the stop position
        var goal = waypoints.last();
        var goalPosition = goal.operationalPointRef;

        // TODO: properly handle ranges
        assert startPosition.begin == startPosition.end;
        assert goalPosition.begin == goalPosition.end;

        var startingPoints = new ArrayList<BasicPathStart<TrackSection>>();
        for (var direction : EdgeDirection.values())
            startingPoints.add(new BasicPathStart<>(0, start.edge, direction, startPosition.begin));

        var costFunction = new DistCostFunction<TrackSection>();
        var goalChecker = new BasicGoalChecker<>(costFunction, goal.edge, goalPosition.begin);

        var trainPath = new TrainPath();
        var foundPaths = BiGraphDijkstra.findPaths(
                infra.trackGraph,
                startingPoints,
                costFunction,
                goalChecker,
                (pathToGoal) -> {
                    var path = FullPathArray.from(pathToGoal);
                    path.forAllSegments(trainPath::addEdge);
                    return false;
                });

        if (foundPaths == 0)
            throw new RuntimeException("dijkstra found no path");

        return trainPath;
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
