package fr.sncf.osrd.interactive.events_adapters;

import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.events.TrainRestartsEvent;

public class SerializedTrainRestarts extends SerializedEvent {
    public SerializedTrainRestarts(TimelineEvent event) {
        super(event.eventId.scheduledTime);
    }

    public static SerializedTrainRestarts fromEvent(TrainRestartsEvent event) {
        return new SerializedTrainRestarts(event);
    }
}
