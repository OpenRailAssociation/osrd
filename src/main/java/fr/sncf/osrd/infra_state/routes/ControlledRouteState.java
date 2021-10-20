package fr.sncf.osrd.infra_state.routes;

import static fr.sncf.osrd.infra_state.routes.RouteStatus.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.cbtc.CBTCNavigatePhase;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.TVDSectionState;
import fr.sncf.osrd.infra_state.regulator.Request;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.utils.SortedArraySet;

public class ControlledRouteState extends RouteState {
    private int movingSwitchesLeft;

    ControlledRouteState(Route route) {
        super(route);
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

    /** Notify the route that one of his tvd section is reserved */
    @Override
    public void onTvdSectionReserved(Simulation sim) throws SimulationError {
        if (status != FREE)
            return;
        updateStatus(sim, CONFLICT);
    }

    /** Notify the route that one of his tvd section is occupied */
    @Override
    public void onTvdSectionOccupied(Simulation sim, TVDSection tvdSection) throws SimulationError {

        if (status == REQUESTED || status == FREE) {
            throw new SimulationError("The TVD section we try to occupy isn't reserved yet");
        }
        if (status != RouteStatus.RESERVED)
            return;

        updateStatus(sim, OCCUPIED);
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
     * Reserve a route and his tvd sections, in CBTC mode if specified. Routes that share tvd sections will
     * have the status CONFLICT
     */
    @Override
    protected void reserveWithGivenCBTC(Simulation sim, boolean cbtc) throws SimulationError {
        if (!(status == FREE || (cbtc && hasCBTCStatus())))
            throw new SimulationError("The route we try to reserve isn't free");

        if (isCBTCReserved != cbtc) {
            var change = new RouteCBTCChange(sim, this, cbtc);
            change.apply(sim, this);
            sim.publishChange(change);
        }

        requestSwitchPositionChange(sim);

        RouteStatus newStatus = movingSwitchesLeft > 0 ? RouteStatus.REQUESTED : RouteStatus.RESERVED;

        updateStatus(sim, newStatus);

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

        // Reserve route via tower state (if denied then throw an error)
        var request = new Request(sim.trains.get(trainState.trainSchedule.trainID), this);
        if (!sim.infraState.towerState.request(sim, request))
            throw new SimulationError(
                    String.format("Initial route reservation: TowerState denied request for route '%s'", route.id));
    }

    /** Should be called when a switch is done moving and is in the position we requested */
    @Override
    public void onSwitchMove(Simulation sim) throws SimulationError {
        movingSwitchesLeft--;
        // If all switches are in the requested position, we mark the route as reserved
        if (movingSwitchesLeft == 0) {
            if (status != RouteStatus.REQUESTED) {
                throw new SimulationError("The Route needs to be REQUESTED if a switch moves");
            }
            updateStatus(sim, RESERVED);
        }
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
