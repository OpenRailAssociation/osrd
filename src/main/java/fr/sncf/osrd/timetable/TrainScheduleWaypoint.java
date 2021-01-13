package fr.sncf.osrd.timetable;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.train.Train;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public class TrainScheduleWaypoint {
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm:ss");

    // TODO: LocalTime doesn't include a day. it's thus impossible to run simulations
    //       spanning over multiple days or countries.
    public final LocalTime time;

    // the duration of the train stop, in seconds
    public final int stopDuration;

    public final OperationalPoint operationalPoint;
    public final TopoEdge edge;

    /**
     * Creates a new train schedule waypoint
     * @param time the expected stop time
     * @param stopDuration the duration of the stop
     * @param operationalPoint the place to stop at
     * @param edge the edge to stop at on the graph
     */
    public TrainScheduleWaypoint(LocalTime time, int stopDuration, OperationalPoint operationalPoint, TopoEdge edge) {
        this.time = time;
        this.stopDuration = stopDuration;
        this.operationalPoint = operationalPoint;
        this.edge = edge;

        assert edge.operationalPoints != null;
        assert edge.operationalPoints.stream()
                .map(pointValue -> pointValue.value)
                .anyMatch(operationalPoint::equals);
    }

    /**
     * Create a new entry for a timetable from a mapped json object
     * @param json the mapped json input
     */
    public static TrainScheduleWaypoint fromJson(JsonTimetableEntry json, Infra infra) {
        var time = LocalTime.parse(json.time, TIME_FORMAT);
        var operationalPoint = infra.operationalPointMap.get(json.operationalPointId);
        var edge = infra.topoEdgeMap.get(json.edgeId);
        return new TrainScheduleWaypoint(time, json.stopDuration, operationalPoint, edge);
    }

    public double timeSeconds() {
        return time.toSecondOfDay();
    }
}
