package fr.sncf.osrd.simulation.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Objects;

public class TimelineEventId implements Comparable<TimelineEventId> {
    // the simulation time the event is planned to execute at
    public final double scheduledTime;

    // the revision of the simulation the event was created at
    // this is needed to enforce an absolute event order
    final long revision;

    public TimelineEventId(double scheduledTime, long revision) {
        this.scheduledTime = scheduledTime;
        this.revision = revision;
    }

    public TimelineEventId(TimelineEventId o) {
        this.scheduledTime = o.scheduledTime;
        this.revision = o.revision;
    }

    @Override
    public int hashCode() {
        return Objects.hash(scheduledTime, revision);
    }

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY", "BC_UNCONFIRMED_CAST"})
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (!(obj instanceof TimelineEventId))
            return false;

        // because of type erasure, we can't cast to the exact type
        TimelineEvent<?> o = (TimelineEvent<?>) obj;
        return scheduledTime == o.scheduledTime && revision == o.revision;
    }

    @Override
    public int compareTo(TimelineEventId o) {
        // events are compared by planned time first, then revision
        int cmpRes = Double.compare(scheduledTime, o.scheduledTime);
        if (cmpRes != 0)
            return cmpRes;

        return Long.compare(revision, o.revision);
    }

    @Override
    public String toString() {
        return String.format("TimelineEventId { scheduledTime=%f, revision=%d }", scheduledTime, revision);
    }
}
