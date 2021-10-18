package fr.sncf.osrd.infra_state.routes;

import static fr.sncf.osrd.infra_state.routes.RouteStatus.FREE;

import fr.sncf.osrd.cbtc.CBTCNavigatePhase;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.TVDSectionState;
import fr.sncf.osrd.simulation.EntityChange;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;

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

    /** Creates an instance of RouteState from the given route */
    public static RouteState from(Route route) {
        if (route.isControlled)
            return new ControlledRouteState(route);
        else
            return new PassiveRouteState(route);
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

    /** Called when a tvd section of the route is freed */
    public void onTvdSectionFreed(Simulation sim) throws SimulationError {
        var isFree = route.tvdSectionsPaths.stream()
                .map(path -> path.tvdSection)
                .map(tvdSection -> sim.infraState.getTvdSectionState(tvdSection.index))
                .noneMatch(TVDSectionState::isReserved);
        if (isFree) {
            isCBTCReserved = false;
            updateStatus(sim, FREE);
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

    public abstract void onTvdSectionReserved(Simulation sim) throws SimulationError;

    public abstract void onTvdSectionOccupied(Simulation sim, TVDSection tvdSection) throws SimulationError;

    protected abstract void reserveWithGivenCBTC(Simulation sim, boolean cbtc) throws SimulationError;

    public abstract void initialReserve(Simulation sim, TrainState trainState) throws SimulationError;

    public abstract void onSwitchMove(Simulation sim) throws SimulationError;

    public static class RouteStatusChange extends EntityChange<RouteState, Void> {
        public final RouteStatus newStatus;
        public final int routeIndex;
        public final String routeID;

        /** create a RouteStatusChange */
        public RouteStatusChange(Simulation sim, RouteState entity, RouteStatus newStatus) {
            super(sim);
            this.newStatus = newStatus;
            this.routeIndex = entity.route.index;
            this.routeID = entity.route.id;
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
            return String.format("RouteStatusChange { route: %d, id: %s, status: %s }", routeIndex, routeID, newStatus);
        }
    }
}
