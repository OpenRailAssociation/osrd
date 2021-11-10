package fr.sncf.osrd.infra_state.regulator;

import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.Train;
import java.util.Objects;

public final class Request {
    public final String trainID;
    public final int routeIndex;

    public Request(Train train, RouteState routeState) {
        this.trainID = train.getID();
        this.routeIndex = routeState.route.index;
    }

    public RouteState getRouteState(Simulation sim) {
        return sim.infraState.getRouteState(routeIndex);
    }

    @Override
    public boolean equals(Object object) {
        if (object == null || object.getClass() != Request.class) {
            return false;
        }
        var request = (Request) object;
        return request.trainID.equals(trainID)
                && routeIndex == request.routeIndex;
    }

    @Override
    public int hashCode() {
        return Objects.hash(trainID, routeIndex);
    }
}
