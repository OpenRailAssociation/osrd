package fr.sncf.osrd.timetable;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.List;

@SuppressFBWarnings(value = "UWF_UNWRITTEN_FIELD")
public class JsonTimetable {
    String name;
    String rollingStockPath;
    double initialSpeed;
    List<JsonTimetableEntry> entries;
}
