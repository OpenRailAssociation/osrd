package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.utils.DeepComparable;

import java.util.ArrayList;

public final class TVDSection implements Comparable<TVDSection> {
    public final String id;
    public final int index;
    public final ArrayList<Waypoint> waypoints;
    public final ArrayList<TVDSectionPath> sections = new ArrayList<>();
    public final ArrayList<Route> routeSubscribers = new ArrayList<>();

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

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class State implements DeepComparable<State> {
        public final TVDSection tvdSection;
        boolean reserved;

        State(TVDSection tvdSection) {
            this.tvdSection = tvdSection;
            this.reserved = false;
        }

        /** Create an event to reserve the tvd section */
        public void reserve(Simulation sim) {
            var change = new TVDSectionReservationChange(sim, this, true);
            change.apply(sim, this);
            sim.publishChange(change);
            for (var route : tvdSection.routeSubscribers) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionReserved(sim);
            }
        }

        /** Create an event to free the tvd section */
        public void free(Simulation sim) {
            var change = new TVDSectionReservationChange(sim, this, false);
            change.apply(sim, this);
            sim.publishChange(change);
            for (var route : tvdSection.routeSubscribers) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionFreed(sim);
            }
        }

        /** Create an event to notify route that the tvd section is occupied */
        public void occupy(Simulation sim) {
            assert reserved;
            for (var route : tvdSection.routeSubscribers) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionOccupied(sim);
            }
        }

        /** Create an event to notify route that the tvd section is not occupied anymore */
        public void unoccupy(Simulation sim) {
            assert reserved;
            for (var route : tvdSection.routeSubscribers) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionUnoccupied(sim, this);
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

    public static final class TVDSectionReservationChange extends EntityChange<TVDSection.State, Void> {
        public final boolean newReservation;
        public final int tvdSectionIndex;

        TVDSectionReservationChange(Simulation sim, TVDSection.State entity, boolean newReservation) {
            super(sim);
            this.newReservation = newReservation;
            this.tvdSectionIndex = entity.tvdSection.index;
        }

        @Override
        public Void apply(Simulation sim, TVDSection.State entity) {
            assert entity.reserved != newReservation;
            entity.reserved = newReservation;
            return null;
        }

        @Override
        public TVDSection.State getEntity(Simulation sim) {
            return sim.infraState.getTvdSectionState(tvdSectionIndex);
        }

        @Override
        public String toString() {
            return String.format(
                    "TVDSectionReservationChange { tvdSection: %d, newReservation: %s }",
                    tvdSectionIndex, newReservation
            );
        }
    }
}
