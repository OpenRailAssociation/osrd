package fr.sncf.osrd.interactive.events_adapters;

import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.events.TrainMoveEvent;

public class SerializedTrainMove extends SerializedEvent {
    private SerializedTrainMove(TimelineEvent event) {
        super(event.eventId.scheduledTime);
    }

    public static SerializedTrainMove fromEvent(TrainMoveEvent event) {
        return new SerializedTrainMove(event);
    }
}
