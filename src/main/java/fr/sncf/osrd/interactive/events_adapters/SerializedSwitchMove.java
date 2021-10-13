package fr.sncf.osrd.interactive.events_adapters;

import com.squareup.moshi.Json;
import fr.sncf.osrd.infra_state.events.SwitchMoveEvent;

public final class SerializedSwitchMove extends SerializedEvent {
    @Json(name = "switch_id")
    public final String switchId;

    public SerializedSwitchMove(double time, String switchId) {
        super(time);
        this.switchId = switchId;
    }

    /** Serialize event */
    public static SerializedSwitchMove fromEvent(SwitchMoveEvent event) {
        var time = event.eventId.scheduledTime;
        var switchId = event.switchState.switchRef.id;
        return new SerializedSwitchMove(time, switchId);
    }
}
