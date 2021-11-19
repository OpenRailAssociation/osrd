package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.TVDSectionPath;
import fr.sncf.osrd.infra_state.regulator.Request;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;

public class ActivateRoute {
    /**
     * This function send reservation requests to the TowerState to reserve the next forwarding routes
     * @param sim the simulation
     * @param train the train that emit the requests
     * @throws SimulationError emmited when an error happens during the reservation
     */
    public static void reserveRoutes(
            Simulation sim,
            Train train
    ) throws SimulationError {
        var lastState = train.getLastState();
        var path = lastState.path;
        for (var routeIndex = lastState.routeIndex + 1; routeIndex < path.routePath.size(); routeIndex++) {
            var route = path.routePath.get(routeIndex);
            var routeState = sim.infraState.getRouteState(route.index);
            if (!route.isControlled()) {
                // passive route
                if (routeState.status != RouteStatus.FREE) {
                    // occupied, we can't look any further
                    break;
                }
                // otherwise, free, we can keep looking forward
                continue;
            }
            // controlled route
            final var towerState = sim.infraState.towerState;
            var request = new Request(train, routeState);
            // Request already approved
            if (towerState.isRequestApproved(sim, request))
                continue;
            // Request in waiting list
            if (towerState.isRequestPending(sim, request))
                break;
            // The request was denied and put in a waiting list
            if (!sim.infraState.towerState.request(sim, request))
                break;
        }
    }

    /** Reserve the initial routes, mark occupied tvd sections and add interactable elements that are under the train
     * to the TrainState*/
    public static void trainCreation(Simulation sim, TrainState trainState) throws SimulationError {
        Route route = trainState.trainSchedule.initialRoute;
        var routeState = sim.infraState.getRouteState(route.index);

        // Reserve the initial route
        if (routeState.status != RouteStatus.FREE)
            throw new SimulationError(String.format(
                    "Impossible to reserve the route '%s' since it is not available.", routeState.route.id));
        routeState.initialReserve(sim, trainState);

        // Reserve the tvdSection where the train is created
        var trainLocation = trainState.location.getHeadLocation();

        for (var i = 0; i < route.tvdSectionsPaths.size(); i++) {
            var currentTvdSectionPath = route.tvdSectionsPaths.get(i);
            occupyTvdSectionPath(sim, currentTvdSectionPath);
            for (var trackSection : currentTvdSectionPath.trackSections)
                if (trackSection.containsLocation(trainLocation))
                    return;
            freeTvdSectionPath(sim, currentTvdSectionPath);
        }
        reserveRoutes(sim, sim.trains.get(trainState.trainSchedule.trainID));
    }

    private static void occupyTvdSectionPath(Simulation sim, TVDSectionPath tvdSectionPath) throws SimulationError {
        var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
        tvdSection.occupy(sim);
    }

    private static void freeTvdSectionPath(Simulation sim, TVDSectionPath tvdSectionPath) throws SimulationError {
        var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
        tvdSection.free(sim);
    }
}
