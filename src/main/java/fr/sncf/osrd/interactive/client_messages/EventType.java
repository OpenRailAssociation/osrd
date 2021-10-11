package fr.sncf.osrd.interactive.client_messages;

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
    ;

    public final Class<? extends TimelineEvent> internalEventType;

    EventType(Class<? extends TimelineEvent> internalEventType) {
        this.internalEventType = internalEventType;
    }

    public static EventType fromEvent(TimelineEvent event) {
        return fromInternalType(event.getClass());
    }

    public static EventType fromInternalType(Class<? extends TimelineEvent> internalType) {
        return internalTypeMap.get(internalType);
    }

    private static final Map<Class<? extends TimelineEvent>, EventType> internalTypeMap = new HashMap<>();

    static {
        for (var eventType : EventType.values())
            internalTypeMap.put(eventType.internalEventType, eventType);
    }
}
