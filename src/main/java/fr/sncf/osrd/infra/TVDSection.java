package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.infra.changes.TVDSectionFreedChange;
import fr.sncf.osrd.utils.DeepComparable;

import java.util.ArrayList;
import java.util.Objects;

public final class TVDSection implements Comparable<TVDSection> {
    public final String id;
    public final int index;
    public final ArrayList<Waypoint> waypoints;
    public final ArrayList<TVDSectionPath> sections = new ArrayList<>();
    public final ArrayList<Route> routes = new ArrayList<>();

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

    public static final class TVDSectionEntityID implements EntityID<TVDSection.State> {
        private final int tvdSectionIndex;

        public TVDSectionEntityID(int tvdSectionIndex) {
            this.tvdSectionIndex = tvdSectionIndex;
        }

        public int getIndex() {
            return tvdSectionIndex;
        }

        @Override
        public State getEntity(Simulation sim) {
            return sim.infraState.getTvdSectionState(tvdSectionIndex);
        }

        @Override
        public int hashCode() {
            return Objects.hash(tvdSectionIndex);
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null || obj.getClass() != TVDSectionEntityID.class)
                return false;
            return tvdSectionIndex == ((TVDSectionEntityID) obj).tvdSectionIndex;
        }
    }

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class State
            extends AbstractEntity<TVDSection.State, TVDSectionEntityID>
            implements DeepComparable<State> {
        public final TVDSection tvdSection;
        boolean reserved;

        State(TVDSection tvdSection) {
            super(new TVDSectionEntityID(tvdSection.index));
            this.tvdSection = tvdSection;
            this.reserved = false;
        }

        /** Create an event to reserve the tvd section */
        public void reserve(Simulation sim) {
            var change = new TVDSectionReservationChange(sim, this, true);
            change.apply(sim, this);
            sim.publishChange(change);
            for (var route : tvdSection.routes) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionReserved();
            }
        }

        /** Create an event to free the tvd section */
        public void free(Simulation sim) {
            var change = new TVDSectionReservationChange(sim, this, false);
            change.apply(sim, this);
            sim.publishChange(change);
            for (var route : tvdSection.routes) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionFreed();
            }
        }

        /** Create an event to notify route that the tvd section is occupied */
        public void occupy(Simulation sim) {
            assert reserved;
            for (var route : tvdSection.routes) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionOccupied();
            }
        }

        /** Create an event to notify route that the tvd section is not occupied anymore */
        public void unoccupy(Simulation sim) {
            assert reserved;
            for (var route : tvdSection.routes) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionUnoccupied();
            }
        }

        public boolean isReserved() {
            return reserved;
        }

        @Override
        public boolean deepEquals(State other) {
            return tvdSection == other.tvdSection && reserved == other.reserved;
        }
    }

    public static final class TVDSectionReservationChange
            extends EntityChange<TVDSection.State, TVDSectionEntityID, Void>
            implements TimelineEventValue {
        public final boolean newReservation;

        public TVDSectionReservationChange(Simulation sim, TVDSection.State entity, boolean newReservation) {
            super(sim, entity.id);
            this.newReservation = newReservation;
        }

        @Override
        public Void apply(Simulation sim, TVDSection.State entity) {
            assert entity.reserved != newReservation;
            entity.reserved = newReservation;
            return null;
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(TimelineEventValue other) {
            if (other.getClass() != TVDSectionReservationChange.class)
                return false;
            var o = (TVDSectionReservationChange) other;
            return o.entityId.equals(entityId) && o.newReservation == newReservation;
        }
    }
}
