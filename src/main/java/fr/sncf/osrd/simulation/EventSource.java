package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.core.Simulation;
import fr.sncf.osrd.simulation.core.SimulationError;

import java.util.ArrayList;

public class EventSource<T extends BaseT, BaseT> {
    ArrayList<EventSink<T, BaseT>> subscribers = new ArrayList<>();

    public void subscribe(EventSink<T, BaseT> sink) {
        assert !subscribers.contains(sink);
        subscribers.add(sink);
    }

    public void unsubscribe(EventSink<T, BaseT> sink) {
        assert subscribers.contains(sink);
        subscribers.remove(sink);
    }

    /**
     * Creates a new event.
     * @param sim the simulation this events belongs to
     * @param scheduledTime the simulation time this event should happen at
     * @param value the value associated with the event
     * @return a new event
     * @throws SimulationError if a logic error occurs
     */
    public Event<T, BaseT> event(Simulation<BaseT> sim, double scheduledTime, T value) throws SimulationError {
        return new Event<>(sim, scheduledTime, value, this);
    }
}
