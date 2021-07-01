package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.ArrayList;
import java.util.List;

/** Describes the planned path for a train
 * For now it is considered read-only, but eventually it may be possible to modify the path */
public class TrainPath {
    public final List<Route> routePath;
    private final ArrayList<TrackSectionRange> trackSectionPath;
    public int routeIndex = 0;

    public TrainPath(List<Route> routePath,
                     TrackSectionLocation startLocation,
                     TrackSectionLocation endLocation) throws InvalidSchedule {
        this.routePath = routePath;
        verifyRoutes(routePath);
        trackSectionPath = Route.routesToTrackSectionRange(routePath, startLocation, endLocation);
    }

    /** Asserts that there are no duplicate routes
     * Eventually we can add more checks to ensure the integrity of the path */
    private static void verifyRoutes(List<Route> routes) throws InvalidSchedule {
        for (int i = 1; i < routes.size(); i++) {
            if (routes.get(i).id.equals(routes.get(i - 1).id))
                throw new InvalidSchedule("Phase path contains duplicate routes: " + routes.get(i).id);
        }
    }

    /** Finds the tvd section after the given waypoint */
    public TVDSection findForwardTVDSection(Waypoint waypoint) {
        // TODO: Find a faster and smarter way to do it
        for (var route : routePath) {
            for (var j = 0; j < route.tvdSectionsPaths.size(); j++) {
                var tvdSectionPath = route.tvdSectionsPaths.get(j);
                var tvdSectionPathDirection = route.tvdSectionsPathDirections.get(j);
                if (tvdSectionPath.getStartNode(tvdSectionPathDirection) == waypoint.index)
                    return tvdSectionPath.tvdSection;
            }
        }
        // No tvd section could be found forward this waypoint
        return null;
    }

    /** Finds the tvd section before the given waypoint */
    private TVDSection findBackwardTVDSection(Waypoint waypoint) {
        // TODO: Find a faster and smarter way to do it
        for (var route : routePath) {
            for (var j = 0; j < route.tvdSectionsPaths.size(); j++) {
                var tvdSectionPath = route.tvdSectionsPaths.get(j);
                var tvdSectionPathDirection = route.tvdSectionsPathDirections.get(j);
                if (tvdSectionPath.getEndNode(tvdSectionPathDirection) == waypoint.index)
                    return tvdSectionPath.tvdSection;
            }
        }

        // There is no previous tvd section on this train path
        return null;
    }

    /** Occupy and free tvd sections given a detector the train is interacting with. */
    public void updateTVDSections(
            Simulation sim,
            Detector detector,
            InteractionType interactionType
    ) throws SimulationError {
        // Update route index
        var currentRoute = routePath.get(routeIndex);
        var tvdSectionPathIndex = currentRoute.tvdSectionsPaths.size() - 1;
        var lastTvdSectionPath = currentRoute.tvdSectionsPaths.get(tvdSectionPathIndex);
        var lastTvdSectionPathDir = currentRoute.tvdSectionsPathDirections.get(tvdSectionPathIndex);
        if (lastTvdSectionPath.getEndNode(lastTvdSectionPathDir) == detector.index)
            routeIndex++;

        // Occupy the next tvdSection
        if (interactionType == InteractionType.HEAD) {
            var forwardTVDSectionPath = findForwardTVDSection(detector);
            if (forwardTVDSectionPath == null)
                return;
            var nextTVDSection = sim.infraState.getTvdSectionState(forwardTVDSectionPath.index);
            nextTVDSection.occupy(sim);
            return;
        }
        // Doesn't occupy the last tvdSection
        var backwardTVDSectionPath = findBackwardTVDSection(detector);
        if (backwardTVDSectionPath == null)
            return;
        var backwardTVDSection = sim.infraState.getTvdSectionState(backwardTVDSectionPath.index);
        backwardTVDSection.unoccupy(sim);
    }
}
