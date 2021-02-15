package fr.sncf.osrd.timetable;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.trackgraph.TrackSection;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

// TODO: use stopDuration
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class TrainScheduleWaypoint {
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm:ss");

    // TODO: LocalTime doesn't include a day. it's thus impossible to run simulations
    //       spanning over multiple days or countries.
    public final LocalTime time;

    // the duration of the train stop, in seconds
    public final int stopDuration;

    public final OperationalPoint operationalPoint;
    public final TrackSection edge;

    private TrainScheduleWaypoint(
            LocalTime time,
            int stopDuration,
            OperationalPoint operationalPoint,
            TrackSection edge
    ) {
        this.time = time;
        this.stopDuration = stopDuration;
        this.operationalPoint = operationalPoint;
        this.edge = edge;
    }

    /**
     * Creates a new train schedule waypoint
     * @param time the expected stop time
     * @param stopDuration the duration of the stop
     * @param operationalPoint the place to stop at
     * @param edge the edge to stop at on the graph
     */
    public static TrainScheduleWaypoint from(
            LocalTime time,
            int stopDuration,
            OperationalPoint operationalPoint,
            TrackSection edge
    ) throws InvalidTimetableException {
        if (edge.operationalPoints.stream()
                .map(pointValue -> pointValue.value)
                .noneMatch(operationalPoint::equals))
            throw new InvalidTimetableException(String.format(
                    "edge %s has no operational point %s", edge.id, operationalPoint.id));
        return new TrainScheduleWaypoint(time, stopDuration, operationalPoint, edge);
    }

    /**
     * Create a new entry for a timetable from a mapped json object
     * @param json the mapped json input
     */
    public static TrainScheduleWaypoint fromJson(
            JsonTimetableEntry json,
            Infra infra
    ) throws InvalidTimetableException {
        var time = LocalTime.parse(json.time, TIME_FORMAT);
        var operationalPoint = infra.operationalPointMap.get(json.operationalPointId);
        if (operationalPoint == null)
            throw new InvalidTimetableException(String.format("unknown operational point %s", json.operationalPointId));

        var edge = infra.trackSectionMap.get(json.edgeId);
        if (edge == null)
            throw new InvalidTimetableException(String.format("unknown edge %s", json.edgeId));
        return TrainScheduleWaypoint.from(time, json.stopDuration, operationalPoint, edge);
    }

    public double timeSeconds() {
        return time.toSecondOfDay();
    }
}
