package fr.sncf.osrd.timetable;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.topological.TopoEdge;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.stream.StreamSupport;

public class TimetableEntry {
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm:ss");

    // TODO: LocalTime doesn't include a day. it's thus impossible to run simulations
    //       spanning over multiple days or countries.
    public final LocalTime time;
    public final int stopTime;
    public final boolean isStop;
    public final OperationalPoint operationalPoint;
    public final TopoEdge edge;

    /**
     * Create a new entry for a timetable from a mapped json object
     * @param json the mapped json input
     */
    public TimetableEntry(JsonTimetableEntry json, Infra infra) {
        time = LocalTime.parse(json.time, TIME_FORMAT);
        stopTime = json.stopTime;
        assert stopTime >= 0;
        isStop = json.isStop;
        assert stopTime == 0 || isStop;
        operationalPoint = infra.operationalPointMap.get(json.operationalPointId);
        edge = infra.topoEdgeMap.get(json.edgeId);
        assert edge.operationalPoints != null;
        assert StreamSupport.stream(edge.operationalPoints.spliterator(), false)
                .map(pointValue -> pointValue.value)
                .anyMatch(operationalPoint::equals);
    }

    public double timeSeconds() {
        return time.toSecondOfDay();
    }
}
