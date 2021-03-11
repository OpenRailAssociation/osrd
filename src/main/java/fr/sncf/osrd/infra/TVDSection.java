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
    public static class State extends AbstractEntity<TVDSection.State, TVDSectionEntityID> {
        public final TVDSection tvdSection;
        private boolean reserved;

        State(TVDSection tvdSection) {
            super(new TVDSectionEntityID(tvdSection.index));
            this.tvdSection = tvdSection;
            this.reserved = false;
        }

        /** Create an event to reserve the tvd section */
        public void reserve(Simulation sim) {
            assert !reserved;
            var change = new TVDSectionReservedChange(sim, this);
            change.apply(sim, this);
            sim.scheduleEvent(this, sim.getTime(), change);
        }

        /** Create an event to free the tvd section */
        public void free(Simulation sim) {
            assert reserved;
            var change = new TVDSectionFreedChange(sim, this);
            change.apply(sim, this);
            sim.scheduleEvent(this, sim.getTime(), change);
        }

        /** Create an event to notify route that the tvd section is occupied */
        public void occupy(Simulation sim) {
            assert reserved;
            sim.scheduleEvent(this, sim.getTime(), new TVDSectionOccupied());
        }

        /** Create an event to notify route that the tvd section is not occupied anymore */
        public void notOccupy(Simulation sim) {
            assert reserved;
            sim.scheduleEvent(this, sim.getTime(), new TVDSectionNotOccupied());
        }

        public boolean isReserved() {
            return reserved;
        }

        @Override
        public void onEventOccurred(Simulation sim, TimelineEvent<?> event) { }

        @Override
        public void onEventCancelled(Simulation sim, TimelineEvent<?> event) { }
    }

    public static final class TVDSectionReservedChange
            extends EntityChange<TVDSection.State, TVDSectionEntityID, Void> {
        public TVDSectionReservedChange(Simulation sim, TVDSection.State entity) {
            super(sim, entity.id);
        }

        @Override
        public Void apply(Simulation sim, TVDSection.State entity) {
            entity.reserved = true;
            return null;
        }
    }

    public static final class TVDSectionFreedChange
            extends EntityChange<TVDSection.State, TVDSectionEntityID, Void> {
        public TVDSectionFreedChange(Simulation sim, TVDSection.State entity) {
            super(sim, entity.id);
        }

        @Override
        public Void apply(Simulation sim, TVDSection.State entity) {
            entity.reserved = false;
            return null;
        }
    }

    public static final class TVDSectionOccupied implements TimelineEventValue { }

    public static final class TVDSectionNotOccupied implements TimelineEventValue { }
}
