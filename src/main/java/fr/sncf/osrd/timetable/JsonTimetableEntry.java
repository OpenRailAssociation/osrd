package fr.sncf.osrd.timetable;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings(value = "UWF_UNWRITTEN_FIELD")
public class JsonTimetableEntry {
    String time;
    int stopDuration;
    String operationalPointId;
    String edgeId;
}
