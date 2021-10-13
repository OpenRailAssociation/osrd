package fr.sncf.osrd.infra_state.routes;

import static fr.sncf.osrd.infra_state.routes.RouteStatus.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.TVDSectionState;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.TrainState;

import java.util.HashSet;
import java.util.Set;

public class PassiveRouteState extends RouteState {

    private final Set<String> occupied = new HashSet<>();

    PassiveRouteState(Route route) {
        super(route);
    }

    @Override
    public void onTvdSectionUnoccupied(Simulation sim, TVDSectionState tvdSectionUnoccupied) throws SimulationError {
        var id = tvdSectionUnoccupied.tvdSection.id;
        assert occupied.contains(id);
        occupied.remove(id);
        if (occupied.isEmpty())
            updateStatus(sim, FREE);
    }

    @Override
    public void onTvdSectionFreed(Simulation sim) throws SimulationError {}

    @Override
    public void onTvdSectionReserved(Simulation sim) throws SimulationError {}

    @Override
    public void onTvdSectionOccupied(Simulation sim, TVDSection tvdSection) throws SimulationError {
        var id = tvdSection.id;
        if (occupied.contains(id))
            throw new SimulationError(String.format("TVD section %s is already occupied", id));
        occupied.add(id);
        updateStatus(sim, OCCUPIED);
    }

    @Override
    protected void reserveWithGivenCBTC(Simulation sim, boolean cbtc) throws SimulationError {}

    @Override
    public void initialReserve(Simulation sim, TrainState trainState) throws SimulationError {}

    @Override
    public void onSwitchMove(Simulation sim) throws SimulationError {
        throw new SimulationError(String.format("Switch move on a passive route (route: %s)", route.id));
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(RSValue other) {
        if (other.getClass() != PassiveRouteState.class)
            return false;
        var o = (PassiveRouteState) other;
        if (route != o.route)
            return false;
        return status == o.status;
    }
}
