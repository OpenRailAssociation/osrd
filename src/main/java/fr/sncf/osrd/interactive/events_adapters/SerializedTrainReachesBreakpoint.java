package fr.sncf.osrd.interactive.events_adapters;

import com.squareup.moshi.Json;
import fr.sncf.osrd.infra.VirtualActionPoint;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;

public final class SerializedTrainReachesBreakpoint extends SerializedEvent {
    @Json(name = "breakpoint_name")
    public final String breakpointName;
    @Json(name = "train_id")
    public final String trainId;

    private SerializedTrainReachesBreakpoint(double time, String breakpointName, String trainId) {
        super(time);
        this.breakpointName = breakpointName;
        this.trainId = trainId;
    }

    /** Serialize a TrainReachesActionPoint event */
    public static SerializedTrainReachesBreakpoint fromEvent(TrainReachesActionPoint event) {
        var time = event.eventId.scheduledTime;
        assert event.interaction.actionPoint.getClass() == VirtualActionPoint.class;
        var virtualActionPoint = (VirtualActionPoint) event.interaction.actionPoint;
        return new SerializedTrainReachesBreakpoint(time, virtualActionPoint.name, event.train.getID());
    }
}
