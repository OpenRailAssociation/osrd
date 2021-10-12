package fr.sncf.osrd.interactive.events_adapters;

import fr.sncf.osrd.infra_state.events.SwitchMoveEvent;
import fr.sncf.osrd.simulation.TimelineEvent;

public class SerializedSwitchMove extends SerializedEvent {
    public SerializedSwitchMove(TimelineEvent event) {
        super(event.eventId.scheduledTime);
    }

    public static SerializedSwitchMove fromEvent(SwitchMoveEvent event) {
        return new SerializedSwitchMove(event);
    }
}
