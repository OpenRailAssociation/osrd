package fr.sncf.osrd.interactive.events_adapters;

import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.events.TrainCreatedEvent;

public class SerializedTrainCreated extends SerializedEvent {
    private SerializedTrainCreated(TimelineEvent event) {
        super(event.eventId.scheduledTime);
    }

    public static SerializedTrainCreated fromEvent(TrainCreatedEvent event) {
        return new SerializedTrainCreated(event);
    }
}
