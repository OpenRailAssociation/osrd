package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Objects;

public abstract class AbstractEvent<T extends BaseT, BaseT> implements Comparable<AbstractEvent<?, ?>> {
    public enum EventState {
        // the event wasn't registered with the simulation
        UNINITIALIZED,

        // the event hasn't happened yet, as its planned time is behind the simulation clock
        SCHEDULED,
        // the event is currently happening
        HAPPENING,

        // the event got cancelled before it happened
        CANCELLED,
        // the event has happened, and can be recycled
        HAPPENED,
        ;

        boolean completed() {
            return this == CANCELLED || this == HAPPENED;
        }
    }

    abstract Iterable<Process<BaseT>> getDependantProcesses();

    EventState state;

    // some value associated with the event
    final T value;

    // the simulation time the event is planned to execute at
    final double scheduledTime;

    // the revision of the simulation the event was created at
    // this is needed to enforce an absolute event order
    final long revision;

    AbstractEvent(double scheduledTime, long revision, T value) {
        this.state = EventState.UNINITIALIZED;
        this.scheduledTime = scheduledTime;
        this.revision = revision;
        this.value = value;
    }

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
        AbstractEvent<?, ?> o = (AbstractEvent<?, ?>) obj;
        return scheduledTime == o.scheduledTime && revision == o.revision;
    }

    @Override
    public int compareTo(AbstractEvent<?, ?> o) {
        assert this.state == EventState.SCHEDULED;
        assert o.state == EventState.SCHEDULED;

        // events are compared by planned time first, then revision
        int cmpRes = Double.compare(scheduledTime, o.scheduledTime);
        if (cmpRes != 0)
            return cmpRes;

        return Long.compare(revision, o.revision);
    }
}
