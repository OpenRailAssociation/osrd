package fr.sncf.osrd.infra_state.routes;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.cbtc.CBTCNavigatePhase;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.TVDSectionState;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.SortedArraySet;

public class ControlledRouteState extends RouteState {
    private int movingSwitchesLeft;

    public ControlledRouteState(Route route) {
        super(route);
        this.status = RouteStatus.FREE;
    }

    /** Notify the route that one of his tvd section isn't occupied anymore */
    @Override
    public void onTvdSectionUnoccupied(Simulation sim, TVDSectionState tvdSectionUnoccupied) throws SimulationError {
        if (status != RouteStatus.OCCUPIED)
            return;

        // TODO This function could be optimized.
        // One way to do it is to add an attribute to tvdSection to know if they're occupied
        var tvdSectionsBehind = new SortedArraySet<TVDSection>();
        for (var tvdSectionPath : route.tvdSectionsPaths) {
            tvdSectionsBehind.add(tvdSectionPath.tvdSection);
            if (tvdSectionPath.tvdSection == tvdSectionUnoccupied.tvdSection)
                break;
        }

        for (var releaseGroup : route.releaseGroups) {
            if (!releaseGroup.contains(tvdSectionUnoccupied.tvdSection))
                continue;
            if (!tvdSectionsBehind.contains(releaseGroup))
                continue;
            for (var releasedTvdSection : releaseGroup) {
                var tvdSection = sim.infraState.getTvdSectionState(releasedTvdSection.index);
                if (tvdSection.isReserved())
                    tvdSection.free(sim);
            }
        }
    }

    /** Notify the route that one of his tvd section was freed */
    @Override
    public void onTvdSectionFreed(Simulation sim) throws SimulationError {
        if (status == RouteStatus.FREE)
            return;

        // Check that all tvd sections are free to free the route
        for (var tvdSectionPath : route.tvdSectionsPaths) {
            var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
            if (tvdSection.isReserved())
                return;
        }

        this.isCBTCReserved = false;
        var change = new RouteStatusChange(sim, this, RouteStatus.FREE);
        change.apply(sim, this);
        sim.publishChange(change);
        notifySignals(sim);
    }

    /** Notify the route that one of his tvd section is reserved */
    @Override
    public void onTvdSectionReserved(Simulation sim) throws SimulationError {
        if (status != RouteStatus.FREE)
            return;
        var change = new RouteStatusChange(sim, this, RouteStatus.CONFLICT);
        change.apply(sim, this);
        sim.publishChange(change);
        notifySignals(sim);
    }

    /** Notify the route that one of his tvd section is occupied */
    @Override
    public void onTvdSectionOccupied(Simulation sim) throws SimulationError {

        if (status == RouteStatus.REQUESTED || status == RouteStatus.FREE) {
            throw new SimulationError("The TVD section we try to occupy isn't reserved yet");
        }

        RouteStatusChange change;
        if (status == RouteStatus.RESERVED) {
            change = new RouteStatusChange(sim, this, RouteStatus.OCCUPIED);
        } else {
            return;
        }
        change.apply(sim, this);
        sim.publishChange(change);
        notifySignals(sim);
    }

    private void notifySignals(Simulation sim) throws SimulationError {
        for (var signal : route.signalSubscribers) {
            var signalState = sim.infraState.getSignalState(signal.index);
            signalState.notifyChange(sim);
        }
    }

    /**
     * Request all switches to move to the position defined by
     * route.switchesPosition
     *
     * @param sim the current simulation
     */
    private void requestSwitchPositionChange(Simulation sim) throws SimulationError {
        // Set the switches in the moving position
        movingSwitchesLeft = 0;
        for (var switchGrp : route.switchesGroup.entrySet()) {
            var switchRef = switchGrp.getKey();
            var group = switchGrp.getValue();
            var switchState = sim.infraState.getSwitchState(switchRef.switchIndex);
            boolean isActiveGrp = switchState.getGroup().equals(group);
            if (!isActiveGrp) {
                movingSwitchesLeft++;
                switchState.requestGroupChange(sim, group, this);
            }
        }
    }

    /**
     * Reserve the tvd sections of the route
     *
     * @param sim the current simulation
     */
    public void reserveTvdSection(Simulation sim) throws SimulationError {
        for (var tvdSectionPath : route.tvdSectionsPaths) {
            var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
            tvdSection.reserve(sim);
        }
    }

    /**
     * Reserve a route and his tvd sections. Routes that share tvd sections will
     * have the status CONFLICT
     *
     * @param sim the current simulation
     */
    @Override
    public void reserve(Simulation sim) throws SimulationError {
        assert status == RouteStatus.FREE;

        isCBTCReserved = false;

        requestSwitchPositionChange(sim);

        RouteStatus newStatus = movingSwitchesLeft > 0 ? RouteStatus.REQUESTED : RouteStatus.RESERVED;

        var change = new RouteStatusChange(sim, this, newStatus);
        change.apply(sim, this);
        sim.publishChange(change);
        notifySignals(sim);

        reserveTvdSection(sim);
    }

    /**
     * Reserve a route and his tvd sections in CBTC. Routes that share tvd sections will
     * have the status CONFLICT
     *
     * @param sim the current simulation
     */
    @Override
    public void cbtcReserve(Simulation sim) throws SimulationError {
        assert status == RouteStatus.FREE || hasCBTCStatus();

        isCBTCReserved = true;

        requestSwitchPositionChange(sim);

        RouteStatus newStatus = movingSwitchesLeft > 0 ? RouteStatus.REQUESTED : RouteStatus.RESERVED;

        var change = new RouteStatusChange(sim, this, newStatus);
        change.apply(sim, this);
        sim.publishChange(change);
        notifySignals(sim);

        reserveTvdSection(sim);
    }

    /** Reserve a route and his tvd sections *when creating a train*.
     * We set the switches position without waiting
     *
     * @param sim the current simulation
     * @param trainState the initial state of the train
     * */
    @Override
    public void initialReserve(Simulation sim, TrainState trainState) throws SimulationError {
        // Set the switches, no delay and waiting this time
        for (var switchGrp : route.switchesGroup.entrySet()) {
            var switchRef = switchGrp.getKey();
            var group = switchGrp.getValue();
            var switchState = sim.infraState.getSwitchState(switchRef.switchIndex);
            switchState.setGroup(sim, group);
        }

        // Get the current phase of the train
        var phase = trainState.trainSchedule.phases.get(trainState.currentPhaseIndex);
        // Call the reservation function corresponding to the current phase type
        if (phase instanceof SignalNavigatePhase) {
            reserve(sim);
        } else if (phase instanceof CBTCNavigatePhase) {
            cbtcReserve(sim);
        }
    }

    /** Should be called when a switch is done moving and is in the position we requested */
    @Override
    public void onSwitchMove(Simulation sim) throws SimulationError {
        movingSwitchesLeft--;
        // If all switches are in the requested position, we mark the route as reserved
        if (movingSwitchesLeft == 0) {
            RouteStatusChange change;
            // We mark the route in the reservation mode corresponding to the current
            // request mode
            if (status == RouteStatus.REQUESTED) {
                change = new RouteStatusChange(sim, this, RouteStatus.RESERVED);
            } else {
                throw new SimulationError("The Route needs to be REQUESTED if a switch moves");
            }
            change.apply(sim, this);
            sim.publishChange(change);
            notifySignals(sim);
        }
    }

    @Override
    public int getEnumValue() {
        return status.ordinal();
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(RSValue other) {
        if (other.getClass() != ControlledRouteState.class)
            return false;
        var o = (ControlledRouteState) other;
        if (route != o.route)
            return false;
        return status == o.status;
    }
}
