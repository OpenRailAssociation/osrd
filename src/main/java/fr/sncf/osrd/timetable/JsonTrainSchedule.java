package fr.sncf.osrd.timetable;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.List;

@SuppressFBWarnings(value = "UWF_UNWRITTEN_FIELD")
public class JsonTrainSchedule {
    String name;
    @Json(name = "rolling_stock_path")
    String rollingStockPath;
    @Json(name = "initial_speed")
    double initialSpeed;
    List<JsonTimetableEntry> waypoints;
}
