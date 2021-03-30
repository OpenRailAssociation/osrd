package fr.sncf.osrd.infra_state;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.simulation.EntityChange;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.utils.DeepComparable;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class TVDSectionState implements DeepComparable<TVDSectionState> {
    public final TVDSection tvdSection;
    boolean reserved;

    public TVDSectionState(TVDSection tvdSection) {
        this.tvdSection = tvdSection;
        this.reserved = false;
    }

    /**
     * Create an event to reserve the tvd section
     */
    public void reserve(Simulation sim) {
        var change = new TVDSectionReservationChange(sim, this, true);
        change.apply(sim, this);
        sim.publishChange(change);
        for (var route : tvdSection.routeSubscribers) {
            var routeState = sim.infraState.getRouteState(route.index);
            routeState.onTvdSectionReserved(sim);
        }
    }

    /**
     * Create an event to free the tvd section
     */
    public void free(Simulation sim) {
        var change = new TVDSectionReservationChange(sim, this, false);
        change.apply(sim, this);
        sim.publishChange(change);
        for (var route : tvdSection.routeSubscribers) {
            var routeState = sim.infraState.getRouteState(route.index);
            routeState.onTvdSectionFreed(sim);
        }
    }

    /**
     * Create an event to notify route that the tvd section is occupied
     */
    public void occupy(Simulation sim) {
        assert reserved;
        for (var route : tvdSection.routeSubscribers) {
            var routeState = sim.infraState.getRouteState(route.index);
            routeState.onTvdSectionOccupied(sim);
        }
    }

    /**
     * Create an event to notify route that the tvd section is not occupied anymore
     */
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
    public boolean deepEquals(TVDSectionState other) {
        return tvdSection == other.tvdSection && reserved == other.reserved;
    }

    public static final class TVDSectionReservationChange extends EntityChange<TVDSectionState, Void> {
        public final boolean newReservation;
        public final int tvdSectionIndex;

        TVDSectionReservationChange(Simulation sim, TVDSectionState entity, boolean newReservation) {
            super(sim);
            this.newReservation = newReservation;
            this.tvdSectionIndex = entity.tvdSection.index;
        }

        @Override
        public Void apply(Simulation sim, TVDSectionState entity) {
            assert entity.reserved != newReservation;
            entity.reserved = newReservation;
            return null;
        }

        @Override
        public TVDSectionState getEntity(Simulation sim) {
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
