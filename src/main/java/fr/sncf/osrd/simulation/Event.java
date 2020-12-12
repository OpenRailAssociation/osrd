package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.ArrayList;
import java.util.Objects;

public final class Event<EventValueT> implements Comparable<Event<EventValueT>> {
    public enum State {
        // the event has no planned execution time yet
        UNPLANNED,
        // the event hasn't happened yet, as its planned time is behind the simulation clock
        SCHEDULED,
        // the event is currently happening
        HAPPENING,
        // the event got cancelled before it happened
        CANCELLED,
        // the event has happened, and can be recycled
        HAPPENED,
    }

    /**
     * Single use events can be recycled, and go from the HAPPENING state to the HAPPENED state
     * Multi use events automatically rearm, and go from the HAPPENING state to the UNPLANNED state
     */

    public enum EventType {
        SINGLE_USE,
        MULTI_USE,
    }

    EventType type;

    // some value associated with the event
    EventValueT value;

    State state;

    Event(EventType type, long revision) {
        this.type = type;
        state = State.UNPLANNED;
        this.scheduledTime = Double.POSITIVE_INFINITY;
        this.revision = revision;
        this.value = null;
    }

    void recycle() {
        assert state != State.UNPLANNED : "only events that already happened can be recycled";
        assert waitingProcesses.isEmpty();
        this.scheduledTime = Double.POSITIVE_INFINITY;
        this.revision = -1;
        this.state = State.UNPLANNED;
        this.value = null;
    }

    void schedule(double scheduledTime, long revision) {
        assert state == State.UNPLANNED : "only unplanned events can be scheduled";
        assert waitingProcesses.isEmpty();
        this.scheduledTime = scheduledTime;
        this.revision = revision;
        this.state = State.SCHEDULED;
    }

    // the simulation time the event is planned to execute at
    double scheduledTime;

    // the revision of the simulation the event was created at
    // this is needed to enforce an absolute event order
    long revision;

    ArrayList<Process<EventValueT>> waitingProcesses = new ArrayList<>();

    @Override
    public int hashCode() {
        return Objects.hash(scheduledTime, revision);
    }

    @Override
    @SuppressFBWarnings(value = "FE_FLOATING_POINT_EQUALITY")
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (getClass() != obj.getClass())
            return false;

        // because of type erasure, we can't cast to the exact type
        Event<?> o = (Event<?>) obj;
        return scheduledTime == o.scheduledTime && revision == o.revision;
    }

    @Override
    public int compareTo(Event<EventValueT> o) {
        // events are compared by planned time first, then revision
        int cmpRes = Double.compare(scheduledTime, o.scheduledTime);
        if (cmpRes != 0)
            return cmpRes;

        return Long.compare(revision, o.revision);
    }
}
