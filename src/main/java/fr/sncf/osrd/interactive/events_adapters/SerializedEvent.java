package fr.sncf.osrd.interactive.events_adapters;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.interactive.client_messages.EventType;
import fr.sncf.osrd.simulation.TimelineEvent;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

public abstract class SerializedEvent {
    public static final PolymorphicJsonAdapterFactory<SerializedEvent> adapter = (
            PolymorphicJsonAdapterFactory.of(SerializedEvent.class, "event_type")
                    .withSubtype(SerializedSwitchMove.class, EventType.SWITCH_MOVE.name())
                    .withSubtype(SerializedTrainCreated.class, EventType.TRAIN_CREATED.name())
                    .withSubtype(SerializedTrainMove.class, EventType.TRAIN_MOVE.name())
                    .withSubtype(SerializedTrainReachesActionPoint.class, EventType.TRAIN_REACHES_ACTION_POINT.name())
                    .withSubtype(SerializedTrainReachesBreakpoint.class, EventType.TRAIN_REACHES_BREAKPOINT.name())
                    .withSubtype(SerializedTrainRestarts.class, EventType.TRAIN_RESTARTS.name())
    );

    public final double time;

    public SerializedEvent(double time) {
        this.time = time;
    }

    /** Serialize event */
    public static SerializedEvent from(TimelineEvent event) {
        var eventType = EventType.fromEvent(event);
        var serializedClass = eventType.serializedEventType;
        try {
            Method fromEvent = serializedClass.getMethod("fromEvent", eventType.internalEventType);
            return (SerializedEvent) fromEvent.invoke(null, event);
        } catch (NoSuchMethodException e) {
            throw new RuntimeException(
                    String.format("Missing 'fromEvent' static method for event '%s'", eventType), e);
        } catch (InvocationTargetException e) {
            throw new RuntimeException("Fail running fromEvent method", e);
        } catch (IllegalAccessException e) {
            throw new RuntimeException("Wrong visibility for 'fromEvent' method", e);
        }
    }
}
