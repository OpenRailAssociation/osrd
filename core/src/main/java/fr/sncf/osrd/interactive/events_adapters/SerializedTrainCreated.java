package fr.sncf.osrd.interactive.events_adapters;

import com.squareup.moshi.Json;
import fr.sncf.osrd.train.events.TrainCreatedEvent;

public final class SerializedTrainCreated extends SerializedEvent {
    @Json(name = "train_id")
    public final String trainId;

    private SerializedTrainCreated(double time, String trainId) {
        super(time);
        this.trainId = trainId;
    }

    /** Serialize event */
    public static SerializedTrainCreated fromEvent(TrainCreatedEvent event) {
        var time = event.eventId.scheduledTime;
        var trainId = event.schedule.trainID;
        return new SerializedTrainCreated(time, trainId);
    }
}
