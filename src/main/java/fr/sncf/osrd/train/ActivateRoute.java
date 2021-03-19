package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteStatus;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;

public class ActivateRoute {
    /** This function try to reserve forwarding routes */
    public static void reserveRoutes(Simulation sim, SignalNavigatePhase.State navigatePhaseState) {
        if (navigatePhaseState.phase.routePath.size() == navigatePhaseState.getRouteIndex())
            return;
        var nextRoute = navigatePhaseState.phase.routePath.get(navigatePhaseState.getRouteIndex() + 1);
        var nextRouteState = sim.infraState.getRouteState(nextRoute.index);
        // Try to reserve the route if possible
        if (nextRouteState.status == RouteStatus.FREE)
            nextRouteState.reserve(sim);
    }

    /** Reserve the initial routes, mark occupied tvd sections and add interactable elements that are under the train
     * to the TrainState*/
    public static void trainCreation(Simulation sim, TrainState trainState) throws SimulationError {
        // TODO
        Route route = trainState.trainSchedule.initialRoute;
        var routeState = sim.infraState.getRouteState(route.index);

        // Try to reserve the route if possible
        if (routeState.status != RouteStatus.FREE)
            throw new SimulationError(
                    String.format("Impossible to reserve the route '%s' since it is not available.", routeState.id));
        routeState.reserve(sim);

        var initialPosition = trainState.location;
        var interactablesUnderTrain = trainState.interactablesUnderTrain;
        for (var i = 0; i < route.tvdSectionsPath.size(); i++) {
            var tvdSectionPath = route.tvdSectionsPath.get(i);
            var tvdSectionPathDir = route.tvdSectionsPathDirection.get(i);
            // TODO ...
        }
    }
}
