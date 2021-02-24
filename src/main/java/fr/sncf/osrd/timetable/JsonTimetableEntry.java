package fr.sncf.osrd.timetable;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings(value = "UWF_UNWRITTEN_FIELD")
public class JsonTimetableEntry {
    String time;
    @Json(name = "stop_duration")
    int stopDuration;
    @Json(name = "operational_point_id")
    String operationalPointId;
    @Json(name = "edge_id")
    String edgeId;
}
