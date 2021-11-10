package fr.sncf.osrd.interactive.events_adapters;

import com.squareup.moshi.Json;
import fr.sncf.osrd.interactive.action_point_adapters.SerializedActionPoint;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;

public final class SerializedTrainReachesActionPoint extends SerializedEvent {
    @Json(name = "train_id")
    public final String trainId;
    @Json(name = "interaction_type")
    public final InteractionType interactionType;
    @Json(name = "action_point")
    public final SerializedActionPoint actionPoint;

    private SerializedTrainReachesActionPoint(
            double time,
            String trainId,
            InteractionType interactionType,
            SerializedActionPoint actionPoint
    ) {
        super(time);
        this.trainId = trainId;
        this.interactionType = interactionType;
        this.actionPoint = actionPoint;
    }

    /** Serialize event */
    public static SerializedTrainReachesActionPoint fromEvent(TrainReachesActionPoint event) {
        var time = event.eventId.scheduledTime;
        var trainId = event.train.schedule.trainID;
        var interactionType = event.interaction.interactionType;
        var actionPointId = SerializedActionPoint.from(event.interaction.actionPoint);
        return new SerializedTrainReachesActionPoint(time, trainId, interactionType, actionPointId);
    }
}
