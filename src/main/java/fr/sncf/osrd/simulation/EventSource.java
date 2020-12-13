package fr.sncf.osrd.simulation;

import java.util.ArrayList;

public class EventSource<T extends BaseT, BaseT> {
    ArrayList<EventSink<T, BaseT>> subscribers = new ArrayList<>();

    public void subscribe(EventSink<T, BaseT> sink) {
        assert !subscribers.contains(sink);
        subscribers.add(sink);
    }
}
