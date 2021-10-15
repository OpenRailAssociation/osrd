package fr.sncf.osrd.infra_state;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.simulation.EntityChange;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.utils.DeepComparable;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class TVDSectionState implements DeepComparable<TVDSectionState> {
    public final TVDSection tvdSection;
    /** Number of train for which the tvd section is reserved */
    int reservation;

    /** Is the tvd section currently occupied */
    private boolean isOccupied = false;

    public TVDSectionState(TVDSection tvdSection) {
        this.tvdSection = tvdSection;
        this.reservation = 0;
    }

    /**
     * Create an event to reserve the tvd section
     *
     * @param sim the current simulation
     */
    public void reserve(Simulation sim) throws SimulationError {
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
     *
     * @param sim the current simulation
     */
    public void free(Simulation sim) throws SimulationError {
        var change = new TVDSectionReservationChange(sim, this, false);
        change.apply(sim, this);
        sim.publishChange(change);

        for (var route : tvdSection.routeSubscribers) {
            var routeState = sim.infraState.getRouteState(route.index);
            routeState.onTvdSectionFreed(sim);
        }

        // notify the switch post that the TVDSection was freed
        sim.infraState.towerState.notifyTVDSectionFreed(sim, this.tvdSection);
    }

    /**
     * Create an event to notify route that the tvd section is occupied
     *
     * @param sim the current simulation
     */
    public void occupy(Simulation sim) throws SimulationError {
        if (isOccupied)
            throw new SimulationError("TVD section we try to occupy is already occupied");
        var change = new TVDSectionOccupationChange(sim, this, true);
        change.apply(sim, this);
        sim.publishChange(change);
        // We need to notify the passive route first, as it may put the controlled routes in the CONFLICT state
        callbackAllRoutes(sim, false);
        callbackAllRoutes(sim, true);
    }

    /** Notifies all the passive or controlled routes that go through this TVD section */
    private void callbackAllRoutes(Simulation sim, boolean controlled) throws SimulationError {
        for (var route : tvdSection.routeSubscribers) {
            if (route.isControlled == controlled) {
                var routeState = sim.infraState.getRouteState(route.index);
                routeState.onTvdSectionOccupied(sim, tvdSection);
            }
        }
    }

    /**
     * Create an event to notify route that the tvd section is not occupied anymore
     *
     * @param sim the current simulation
     */
    public void unoccupy(Simulation sim) throws SimulationError {
        var change = new TVDSectionOccupationChange(sim, this, false);
        change.apply(sim, this);
        sim.publishChange(change);
        for (var route : tvdSection.routeSubscribers) {
            var routeState = sim.infraState.getRouteState(route.index);
            routeState.onTvdSectionUnoccupied(sim, this);
        }
    }

    /**
     * Check if the tvdSection is reserved
     *
     * @return True if the tvdSection is reserved by at least one train
     */
    public boolean isReserved() {
        return reservation != 0;
    }

    /** Is the tvd section currently occupied */
    public boolean isOccupied() {
        return isOccupied;
    }

    @Override
    public boolean deepEquals(TVDSectionState other) {
        return tvdSection == other.tvdSection && reservation == other.reservation;
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
            if (!newReservation)
                assert entity.isReserved();
            entity.reservation += (newReservation) ? 1 : -1;
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

    public static final class TVDSectionOccupationChange extends EntityChange<TVDSectionState, Void> {
        public final boolean newOccupation;
        public final int tvdSectionIndex;

        TVDSectionOccupationChange(Simulation sim, TVDSectionState entity, boolean newOccupation) {
            super(sim);
            this.newOccupation = newOccupation;
            this.tvdSectionIndex = entity.tvdSection.index;
        }

        @Override
        public Void apply(Simulation sim, TVDSectionState entity) {
            entity.isOccupied = newOccupation;
            return null;
        }

        @Override
        public TVDSectionState getEntity(Simulation sim) {
            return sim.infraState.getTvdSectionState(tvdSectionIndex);
        }

        @Override
        public String toString() {
            return String.format(
                    "TVDSectionOccupationChange { tvdSection: %d, newOccupation: %s }",
                    tvdSectionIndex, newOccupation
            );
        }
    }
}
