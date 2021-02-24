package fr.sncf.osrd.timetable;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;

import java.util.List;

public class JsonSchedule {
    public static final JsonAdapter<JsonSchedule> adapter = new Moshi
            .Builder()
            .build()
            .adapter(JsonSchedule.class)
            .failOnUnknown();

    @Json(name = "train_schedules")
    List<JsonTrainSchedule> trainSchedules;
}
