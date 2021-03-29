package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteStatus;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;

public class ActivateRoute {
    /** This function try to reserve forwarding routes */
    public static void reserveRoutes(Simulation sim, SignalNavigatePhase.State navigatePhaseState) {
        // TODO have a smarter way to reserve routes
        if (navigatePhaseState.getRouteIndex() + 1 >= navigatePhaseState.phase.routePath.size())
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
        Route route = trainState.trainSchedule.initialRoute;
        var routeState = sim.infraState.getRouteState(route.index);

        // Reserve the initial route
        if (routeState.status != RouteStatus.FREE)
            throw new SimulationError(String.format(
                    "Impossible to reserve the route '%s' since it is not available.", routeState.route.id));
        routeState.reserve(sim);

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

    private static void occupyTvdSectionPath(Simulation sim, TVDSectionPath tvdSectionPath) {
        var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
        tvdSection.occupy(sim);
    }

    private static void freeTvdSectionPath(Simulation sim, TVDSectionPath tvdSectionPath) {
        var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
        tvdSection.free(sim);
    }
}
