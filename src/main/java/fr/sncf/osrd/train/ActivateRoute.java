package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.infra_state.RouteStatus;
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
        // TODO have a smarter way to reserve routes
        var lastState = train.getLastState();
        if (lastState.routeIndex + 1 >= lastState.path.routePath.size())
            return;
        var nextRoute = lastState.path.routePath.get(lastState.routeIndex + 1);
        var nextRouteState = sim.infraState.getRouteState(nextRoute.index);
        sim.infraState.towerState.request(sim, nextRouteState, train);
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
        routeState.initialReserve(sim);

        // Reserve the tvdSection where the train is created
        var trainPosition = trainState.location.trackSectionRanges.getFirst();

        var lastTvdSectionPath = route.tvdSectionsPaths.get(0);
        occupyTvdSectionPath(sim, lastTvdSectionPath);

        for (var i = 0; i < route.tvdSectionsPaths.size(); i++) {
            var currentTvdSectionPath = route.tvdSectionsPaths.get(i);
            var currentTvdSectionPathDirection = route.tvdSectionsPathDirections.get(i);
            for (var trackSection : currentTvdSectionPath.getTrackSections(currentTvdSectionPathDirection)) {
                if (trainPosition.intersect(trackSection))
                    return;
            }
            freeTvdSectionPath(sim, lastTvdSectionPath);
            occupyTvdSectionPath(sim, currentTvdSectionPath);
            lastTvdSectionPath = currentTvdSectionPath;
        }
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
