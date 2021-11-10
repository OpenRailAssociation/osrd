package fr.sncf.osrd.interactive.events_adapters;

import com.squareup.moshi.Json;
import fr.sncf.osrd.train.events.TrainRestartsEvent;

public final class SerializedTrainRestarts extends SerializedEvent {
    @Json(name = "train_id")
    public final String trainId;

    public SerializedTrainRestarts(double time, String trainId) {
        super(time);
        this.trainId = trainId;
    }

    /** Serialize event */
    public static SerializedTrainRestarts fromEvent(TrainRestartsEvent event) {
        var time = event.eventId.scheduledTime;
        var trainId = event.train.schedule.trainID;
        return new SerializedTrainRestarts(time, trainId);
    }
}
