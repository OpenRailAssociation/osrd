package fr.sncf.osrd.interactive.events_adapters;

import com.squareup.moshi.Json;
import fr.sncf.osrd.train.events.TrainMoveEvent;

public final class SerializedTrainMove extends SerializedEvent {
    @Json(name = "train_id")
    public final String trainId;

    private SerializedTrainMove(double time, String trainId) {
        super(time);
        this.trainId = trainId;
    }

    /** Serialize event */
    public static SerializedTrainMove fromEvent(TrainMoveEvent event) {
        var time = event.eventId.scheduledTime;
        var trainId = event.train.schedule.trainID;
        return new SerializedTrainMove(time, trainId);
    }
}
