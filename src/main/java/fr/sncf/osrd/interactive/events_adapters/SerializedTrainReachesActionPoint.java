package fr.sncf.osrd.interactive.events_adapters;

import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;

public class SerializedTrainReachesActionPoint extends SerializedEvent {
    private SerializedTrainReachesActionPoint(TimelineEvent event) {
        super(event.eventId.scheduledTime);
    }

    public static SerializedTrainReachesActionPoint fromEvent(TrainReachesActionPoint event) {
        return new SerializedTrainReachesActionPoint(event);
    }
}
