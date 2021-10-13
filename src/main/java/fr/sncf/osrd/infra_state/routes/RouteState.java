package fr.sncf.osrd.infra_state.routes;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.cbtc.CBTCNavigatePhase;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.TVDSectionState;
import fr.sncf.osrd.simulation.EntityChange;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.SortedArraySet;

/**
 * The state of the route is the actual entity which interacts with the rest of the infrastructure
 */
public abstract class RouteState implements RSMatchable {
    public final Route route;
    public RouteStatus status;
    protected boolean isCBTCReserved;

    public RouteState(Route route) {
        this.route = route;
        this.status = RouteStatus.FREE;
    }

    /**
     * Check if the route has a CBTC status
     */
    public boolean hasCBTCStatus() {
        return isCBTCReserved;
    }

    protected void notifySignals(Simulation sim) throws SimulationError {
        for (var signal : route.signalSubscribers) {
            var signalState = sim.infraState.getSignalState(signal.index);
            signalState.notifyChange(sim);
        }
    }

    protected void updateStatus(Simulation sim, RouteStatus newStatus) throws SimulationError {
        var change = new RouteStatusChange(sim, this, newStatus);
        change.apply(sim, this);
        sim.publishChange(change);
        notifySignals(sim);
    }

    public int getEnumValue() {
        return status.ordinal();
    }

    public void cbtcReserve(Simulation sim) throws SimulationError {
        reserveWithGivenCBTC(sim, true);
    }

    public void reserve(Simulation sim) throws SimulationError {
        reserveWithGivenCBTC(sim, false);
    }

    /**
     * Reserve a route and his tvd sections. Routes that share tvd sections will
     * have the status CONFLICT
     *
     * @param sim   the current simulation
     * @param train the train for which we wish to reserve a route
     */
    public void reserve(Simulation sim, Train train) throws SimulationError {
        // Get the current phase of the train
        var trainState = train.getLastState();
        var phase = trainState.trainSchedule.phases.get(trainState.currentPhaseIndex);
        // Call the reservation function corresponding to the current phase type
        if (phase instanceof SignalNavigatePhase) {
            reserve(sim);
        } else if (phase instanceof CBTCNavigatePhase) {
            cbtcReserve(sim);
        }
    }


    public abstract void onTvdSectionUnoccupied(Simulation sim, TVDSectionState tvdSectionUnoccupied)
            throws SimulationError;

    public abstract void onTvdSectionFreed(Simulation sim) throws SimulationError;

    public abstract void onTvdSectionReserved(Simulation sim) throws SimulationError;

    public abstract void onTvdSectionOccupied(Simulation sim) throws SimulationError;

    protected abstract void reserveWithGivenCBTC(Simulation sim, boolean cbtc) throws SimulationError;

    public abstract void initialReserve(Simulation sim, TrainState trainState) throws SimulationError;

    public abstract void onSwitchMove(Simulation sim) throws SimulationError;

    public static class RouteStatusChange extends EntityChange<RouteState, Void> {
        public final RouteStatus newStatus;
        public final int routeIndex;

        /** create a RouteStatusChange */
        public RouteStatusChange(Simulation sim, RouteState entity, RouteStatus newStatus) {
            super(sim);
            this.newStatus = newStatus;
            this.routeIndex = entity.route.index;
        }

        @Override
        public Void apply(Simulation sim, RouteState entity) {
            entity.status = newStatus;
            return null;
        }

        @Override
        public RouteState getEntity(Simulation sim) {
            return sim.infraState.getRouteState(routeIndex);
        }

        @Override
        public String toString() {
            return String.format("RouteStatusChange { route: %d, status: %s }", routeIndex, newStatus);
        }
    }
}
