package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.simulation.*;

import java.util.ArrayList;

public final class TVDSection implements Comparable<TVDSection> {
    public final String id;
    public final int index;
    public final ArrayList<Waypoint> waypoints;
    public final ArrayList<TVDSectionPath> sections = new ArrayList<>();
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final boolean isBerthingTrack;

    /**
     * Instantiate a TVDSection.
     * Note: The list of TVDSectionPath will be automatically be filled building the infra.
     */
    public TVDSection(String id, int index, ArrayList<Waypoint> waypoints, boolean isBerthingTrack) {
        this.id = id;
        this.index = index;
        this.waypoints = waypoints;
        this.isBerthingTrack = isBerthingTrack;
    }

    @Override
    public int compareTo(TVDSection o) {
        return id.compareTo(o.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != TVDSection.class)
            return false;
        return id.equals(((TVDSection) obj).id);
    }

    public TVDSection.State newState() {
        return new TVDSection.State(this);
    }

    public static class TVDSectionEntityID implements EntityID<TVDSection.State> {
        private final int tvdSectionIndex;

        public TVDSectionEntityID(int tvdSectionIndex) {
            this.tvdSectionIndex = tvdSectionIndex;
        }

        @Override
        public State getEntity(Simulation sim) {
            return sim.infraState.getTvdSectionState(tvdSectionIndex);
        }
    }

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class State extends AbstractEntity<TVDSection.State> {
        public final TVDSection tvdSection;
        private boolean reserved;

        State(TVDSection tvdSection) {
            super(new TVDSectionEntityID(tvdSection.index));
            this.tvdSection = tvdSection;
            this.reserved = false;
        }

        @Override
        public void onTimelineEventUpdate(
                Simulation sim,
                TimelineEvent<?> event,
                TimelineEvent.State state
        ) throws SimulationError { }

        /** Mark the tvd section as reserved */
        public void reserve(Simulation sim) throws SimulationError {
            if (!reserved) {
                reserved = true;
                notifySubscribers(sim);
            }
        }

        /** Mark the tvd section as free */
        public void free(Simulation sim) throws SimulationError {
            if (reserved) {
                reserved = false;
                notifySubscribers(sim);
            }
        }

        private void notifySubscribers(Simulation sim) throws SimulationError {
            sim.createEvent(this, 0, new TVDSectionUpdateEvent());
        }

        public boolean isReserved() {
            return reserved;
        }
    }

    public static class TVDSectionUpdateEvent implements TimelineEventValue { }
}
