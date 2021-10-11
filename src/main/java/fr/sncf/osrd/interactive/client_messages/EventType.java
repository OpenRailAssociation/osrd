package fr.sncf.osrd.interactive.client_messages;

import fr.sncf.osrd.infra.VirtualActionPoint;
import fr.sncf.osrd.infra_state.events.SwitchMoveEvent;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.train.events.TrainRestarts;

import java.util.HashMap;
import java.util.Map;

public enum EventType {
    TRAIN_CREATED(TrainCreatedEvent.class),
    TRAIN_MOVE_EVENT(TrainMoveEvent.class),
    TRAIN_REACHES_ACTION_POINT(TrainReachesActionPoint.class),
    TRAIN_RESTARTS(TrainRestarts.class),
    SWITCH_MOVE(SwitchMoveEvent.class),
    TRAIN_REACHES_BREAKPOINT(TrainReachesActionPoint.class),
    ;

    public final Class<? extends TimelineEvent> internalEventType;

    EventType(Class<? extends TimelineEvent> internalEventType) {
        this.internalEventType = internalEventType;
    }

    /** Given an event return the event type.
     * This function handle the special case of virtual points (breakpoints)
     */
    public static EventType fromEvent(TimelineEvent event) {
        if (event.getClass() != TrainReachesActionPoint.class)
            return internalTypeMap.get(event.getClass());
        // Special case with train reaches action point when it's a virtual action point (breakpoint)
        var trainReachesActionPoint = (TrainReachesActionPoint) event;
        var actionPoint = trainReachesActionPoint.interaction.actionPoint;
        if (actionPoint.getClass() == VirtualActionPoint.class)
            return TRAIN_REACHES_BREAKPOINT;
        return TRAIN_REACHES_ACTION_POINT;
    }

    private static final Map<Class<? extends TimelineEvent>, EventType> internalTypeMap = new HashMap<>();

    static {
        for (var eventType : EventType.values())
            internalTypeMap.put(eventType.internalEventType, eventType);
    }
}
